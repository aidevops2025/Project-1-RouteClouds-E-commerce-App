# RouteClouds Docker Hub CI/CD Setup Guide

## 🚀 **Overview**

This document provides a complete setup guide for the RouteClouds E-Commerce CI/CD pipeline using GitHub Actions and Docker Hub.

## 📋 **Prerequisites**

- ✅ Docker Hub account: `awsfreetier30`
- ✅ GitHub repository with RouteClouds code
- ✅ AWS EKS cluster configured
- ✅ AWS OIDC role for GitHub Actions

## 🔐 **Required GitHub Secrets**

### **Docker Hub Credentials**
```
DOCKER_USERNAME = awsfreetier30
DOCKER_PASSWORD = Dexter#$9
```

### **AWS Configuration**
```
AWS_REGION = us-east-1
EKS_CLUSTER_NAME = bootcamp-dev-cluster
KUBE_NAMESPACE = 3-tier-app-eks
OIDC_ROLE_ARN = arn:aws:iam::ACCOUNT:role/github-actions-role
```

## 🏗️ **CI/CD Pipeline Features**

### **Automated Build Process**
1. **Code Checkout**: Latest code from main/master branch
2. **Node.js Setup**: Version 18 for both frontend and backend
3. **Testing**: Build verification for both applications
4. **Docker Build**: Multi-platform builds with caching
5. **Docker Push**: Images pushed to Docker Hub with tags:
   - `awsfreetier30/routeclouds-backend:latest`
   - `awsfreetier30/routeclouds-backend:${COMMIT_SHA}`
   - `awsfreetier30/routeclouds-frontend:latest`
   - `awsfreetier30/routeclouds-frontend:${COMMIT_SHA}`

### **Automated Deployment**
1. **AWS Authentication**: Via OIDC role
2. **Kubernetes Manifest Updates**: Dynamic image tag updates
3. **EKS Deployment**: Apply all manifests to cluster
4. **Rollout Verification**: Wait for successful deployment
5. **Smoke Testing**: Verify API and frontend accessibility
6. **Automatic Rollback**: On deployment failure

## 🐳 **Docker Hub Images**

### **Current Images Available**
- **Backend**: `awsfreetier30/routeclouds-backend:latest`
  - Node.js/Express API with TypeScript
  - PostgreSQL integration
  - E-commerce endpoints
  - Health checks at `/api/hello`

- **Frontend**: `awsfreetier30/routeclouds-frontend:latest`
  - React/Vite application
  - Nginx production server
  - RouteClouds E-commerce UI
  - Health checks at `/login`

## 🔄 **Workflow Triggers**

### **Automatic Triggers**
- **Push to main/master**: Full CI/CD pipeline
- **Pull Request**: Build and test only (no deployment)

### **Manual Trigger**
- **workflow_dispatch**: Manual pipeline execution

## 📊 **Pipeline Stages**

### **Stage 1: Build & Test**
```yaml
- Checkout code
- Setup Node.js 18
- Test backend (npm ci, npm run build)
- Test frontend (npm ci, npm run build)
```

### **Stage 2: Docker Build & Push**
```yaml
- Login to Docker Hub
- Setup Docker Buildx
- Build backend image with caching
- Build frontend image with caching
- Push both images with latest + SHA tags
```

### **Stage 3: Deploy to EKS**
```yaml
- Configure AWS credentials
- Update K8s manifests with new image tags
- Setup kubectl
- Update kubeconfig for EKS
- Apply manifests to cluster
- Verify rollout status
```

### **Stage 4: Verification & Rollback**
```yaml
- Smoke test backend API (/api/hello)
- Smoke test frontend (/login)
- Automatic rollback on failure
```

## 🛠️ **Setup Instructions**

### **1. Configure GitHub Secrets**
Go to your GitHub repository → Settings → Secrets and variables → Actions

Add all the required secrets listed above.

### **2. Verify Docker Hub Access**
The pipeline will automatically:
- Login to Docker Hub using provided credentials
- Build and push images to your account
- Update Kubernetes manifests with new image references

### **3. Test the Pipeline**
1. Make a code change
2. Push to main/master branch
3. Monitor GitHub Actions tab
4. Verify images appear in Docker Hub
5. Check EKS deployment status

## 🔍 **Monitoring & Troubleshooting**

### **GitHub Actions Logs**
- Build logs show Docker build progress
- Deployment logs show Kubernetes apply status
- Rollback logs indicate any failures

### **Docker Hub Verification**
- Check `awsfreetier30/routeclouds-backend` repository
- Check `awsfreetier30/routeclouds-frontend` repository
- Verify latest tags are updated

### **Kubernetes Verification**
```bash
kubectl get pods -n 3-tier-app-eks
kubectl get deployments -n 3-tier-app-eks
kubectl describe deployment backend -n 3-tier-app-eks
kubectl describe deployment frontend -n 3-tier-app-eks
```

## 🚨 **Rollback Procedures**

### **Automatic Rollback**
- Triggered on deployment failure
- Reverts to previous stable deployment
- Verifies rollback completion

### **Manual Rollback**
```bash
kubectl rollout undo deployment/backend -n 3-tier-app-eks
kubectl rollout undo deployment/frontend -n 3-tier-app-eks
```

## 📈 **Benefits**

1. **Automated Deployments**: Zero-touch deployments
2. **Version Control**: Every commit gets its own Docker image
3. **Rollback Safety**: Automatic failure recovery
4. **Scalability**: Images available for any environment
5. **Team Collaboration**: Consistent deployment process

## 🎯 **Next Steps**

1. ✅ **Images Pushed**: Backend and frontend images in Docker Hub
2. ✅ **Manifests Updated**: All K8s manifests reference Docker Hub
3. ✅ **Pipeline Created**: GitHub Actions workflow ready
4. ⏳ **Secrets Setup**: Configure GitHub repository secrets
5. ⏳ **Test Pipeline**: Push code change to trigger workflow
6. ⏳ **Deploy Cluster**: Spin up EKS and test deployment

---

**Last Updated**: July 11, 2025  
**Maintained By**: DevOps Team  
**Docker Hub Account**: awsfreetier30
