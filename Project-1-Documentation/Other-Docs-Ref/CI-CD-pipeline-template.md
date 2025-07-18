# CI/CD Pipeline Template for 3-Tier Application (GitHub Actions)

---

## Table of Contents
1. [Pipeline Overview](#pipeline-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Variables & Secrets](#environment-variables--secrets)
4. [Recommended Workflow Structure](#recommended-workflow-structure)
5. [Sample GitHub Actions Workflow](#sample-github-actions-workflow)
6. [Rollback & Notification Strategies](#rollback--notification-strategies)
7. [References](#references)

---

## Pipeline Overview
This template provides a robust CI/CD pipeline for the 3-Tier Application (React frontend, Flask backend, PostgreSQL) deployed on AWS EKS. It leverages GitHub Actions, OIDC for secure AWS access, and best practices for build, test, image management, and Kubernetes deployment.

---

## Prerequisites
- AWS ECR repositories for frontend and backend images
- AWS EKS cluster and kubeconfig access
- OIDC/IAM role for GitHub Actions (see infra/oidc.tf)
- Kubernetes manifests in the repository (k8s/)
- Dockerfiles for frontend and backend
- Secrets configured in GitHub repository settings

---

## Environment Variables & Secrets
Set these as GitHub repository secrets:
- `AWS_ACCOUNT_ID`: Your AWS account ID
- `AWS_REGION`: AWS region (e.g., `eu-west-1`)
- `ECR_FRONTEND_REPO`: ECR repo URI for frontend (e.g., `123456789012.dkr.ecr.eu-west-1.amazonaws.com/frontend`)
- `ECR_BACKEND_REPO`: ECR repo URI for backend
- `EKS_CLUSTER_NAME`: Name of your EKS cluster
- `OIDC_ROLE_ARN`: IAM role ARN for GitHub Actions OIDC
- `KUBE_NAMESPACE`: Kubernetes namespace (e.g., `3-tier-app-eks`)
- `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (if using Docker Hub as fallback)

---

## Recommended Workflow Structure
1. **Trigger:** On push to main, PR, or manual dispatch
2. **Checkout:** Pull repository code
3. **Lint & Test:** Run linting and tests for both frontend and backend
4. **Build Docker Images:** Build images for both services
5. **Authenticate to AWS:** Use OIDC to assume deployment role
6. **Push Images to ECR:** Tag and push Docker images
7. **Update Manifests (if needed):** Update image tags in Kubernetes manifests
8. **Deploy to EKS:** Apply manifests using `kubectl`
9. **Post-Deployment Checks:** Verify rollout, run smoke tests
10. **Rollback (if needed):** Roll back to previous image/tag
11. **Notifications:** Send status to Slack, Teams, or email

---

## Sample GitHub Actions Workflow
Below is a template for `.github/workflows/deploy.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    env:
      AWS_REGION: ${{ secrets.AWS_REGION }}
      EKS_CLUSTER_NAME: ${{ secrets.EKS_CLUSTER_NAME }}
      KUBE_NAMESPACE: ${{ secrets.KUBE_NAMESPACE }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python (for backend tests)
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'

      - name: Set up Node.js (for frontend tests)
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Lint & Test Backend
        run: |
          cd 3-tier-app-eks/backend
          pip install -r requirements.txt
          pytest

      - name: Lint & Test Frontend
        run: |
          cd 3-tier-app-eks/frontend
          npm ci
          npm run lint
          npm test -- --watchAll=false

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.OIDC_ROLE_ARN }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and Push Backend Image
        run: |
          cd 3-tier-app-eks/backend
          docker build -t ${{ secrets.ECR_BACKEND_REPO }}:${{ github.sha }} .
          docker push ${{ secrets.ECR_BACKEND_REPO }}:${{ github.sha }}

      - name: Build and Push Frontend Image
        run: |
          cd 3-tier-app-eks/frontend
          docker build -t ${{ secrets.ECR_FRONTEND_REPO }}:${{ github.sha }} .
          docker push ${{ secrets.ECR_FRONTEND_REPO }}:${{ github.sha }}

      - name: Update K8s Manifests with New Image Tags
        run: |
          sed -i "s|image: .*/backend.*|image: ${{ secrets.ECR_BACKEND_REPO }}:${{ github.sha }}|" 3-tier-app-eks/k8s/backend.yaml
          sed -i "s|image: .*/frontend.*|image: ${{ secrets.ECR_FRONTEND_REPO }}:${{ github.sha }}|" 3-tier-app-eks/k8s/frontend.yaml

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'latest'

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region $AWS_REGION --name $EKS_CLUSTER_NAME

      - name: Deploy to EKS
        run: |
          kubectl apply -n $KUBE_NAMESPACE -f 3-tier-app-eks/k8s/

      - name: Verify Rollout
        run: |
          kubectl rollout status deployment/backend -n $KUBE_NAMESPACE
          kubectl rollout status deployment/frontend -n $KUBE_NAMESPACE

      - name: Smoke Test
        run: |
          # Example: curl the frontend or backend endpoint
          echo "Add your smoke test here"

      - name: Notify on Success
        if: success()
        run: |
          echo "Deployment succeeded!"
          # Add Slack or email notification here

      - name: Notify on Failure
        if: failure()
        run: |
          echo "Deployment failed!"
          # Add Slack or email notification here
```

---

## Rollback & Notification Strategies
- **Rollback:**
  - Use `kubectl rollout undo deployment/<name> -n <namespace>` to revert to the previous deployment.
  - Consider keeping previous image tags for quick rollback.
- **Notifications:**
  - Integrate with Slack, Teams, or email using marketplace actions (e.g., `8398a7/action-slack`).
  - Notify on both success and failure for visibility.

---

## References
- [GitHub Actions for AWS](https://github.com/aws-actions/)
- [Amazon EKS Documentation](https://docs.aws.amazon.com/eks/)
- [Kubernetes Deployment Best Practices](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [OIDC for GitHub Actions](https://github.com/aws-actions/configure-aws-credentials#oidc)

---

> **Tip:** Adapt this template to your branching strategy, environment promotion (dev/stage/prod), and team notification preferences. 