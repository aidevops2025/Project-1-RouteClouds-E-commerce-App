Excellent. We have now covered the entire infrastructure and Kubernetes configuration phase. The cluster is ready, and the necessary controllers are in place.

We will now proceed to **Phase 3: Application Deployment**, as detailed in your `3-Tier-Deployment-Document.md`. This is where we deploy the actual 3-tier application components onto our EKS cluster.

### Phase 3: Application Deployment

This phase is arguably the most critical, as it involves deploying the application's core components. The order of deployment specified in your document is essential to prevent dependency-related errors.

#### Step 3.1: Kubernetes Manifest Deployment Order

The guide correctly emphasizes deploying the Kubernetes manifests in a specific sequence. Here’s why that order is so important:

1.  **`namespace.yaml`**
    *   **What it does:** Creates a dedicated logical space within the Kubernetes cluster called `3-tier-app-eks`.
    *   **Why first:** All subsequent resources for this application will be created within this namespace. It acts as a container, providing isolation and organization. You cannot create an object in a namespace that doesn't exist yet.

2.  **`secrets.yaml` and `configmap.yaml`**
    *   **What they do:**
        *   `secrets.yaml`: Creates a Kubernetes `Secret` object to hold sensitive data, such as the database username, password, and full connection URL. The values are base64 encoded, which provides obscurity, not encryption (EKS handles encryption at rest).
        *   `configmap.yaml`: Creates a `ConfigMap` to store non-sensitive configuration data, like the database port and debug flags.
    *   **Why second:** The application pods (specifically the backend) will need to mount these Secrets and ConfigMaps as environment variables to function. They must exist in the cluster *before* the pods that depend on them are created.

3.  **`database-service.yaml`**
    *   **What it does:** This manifest creates a Kubernetes `Service` of type `ExternalName`. This is a clever way to give your external RDS database an internal, cluster-aware DNS name (`postgres-db.3-tier-app-eks.svc.cluster.local`).
    *   **Why third:** It allows your backend deployment to refer to the database by this consistent, internal service name rather than hardcoding the long, external RDS endpoint. This makes the application more portable and configurable. The backend deployment depends on this service name for its database connection.

4.  **`migration_job.yaml`**
    *   **What it does:** This creates a Kubernetes `Job`. A Job is a resource that creates one or more pods and ensures that a specified number of them successfully terminate. In this case, it runs a pod using the backend container image, which executes the `./migrate.sh` script. This script initializes the database schema.
    *   **Why fourth:** The database must be ready and its schema must be set up *before* the main backend application starts trying to read and write data. Running this as a one-off job ensures the database is prepared.

#### Step 3.2: Application Services Deployment

Once the prerequisites are in place, you can deploy the main application tiers.

*   **`backend.yaml` and `frontend.yaml`**
    *   **What they do:** Each of these files defines two primary Kubernetes objects:
        1.  A **`Deployment`**: This manages the lifecycle of your application pods. It ensures that a specified number of replicas (in your case, 2) are always running. If a pod crashes, the Deployment will automatically create a new one. It also defines the container image to use, ports, and environment variables (which are pulled from the Secrets and ConfigMaps we created earlier).
        2.  A **`Service`**: This creates a stable internal network endpoint for the pods managed by the Deployment. Since pods can be created and destroyed, their IP addresses are ephemeral. A Service provides a single, stable DNS name and IP address (`backend.3-tier-app-eks` and `frontend.3-tier-app-eks`) that other pods can use to communicate with them.

#### Step 3.3: Verify Application Deployment

This final step in the phase is about ensuring everything came up correctly.

*   **`kubectl get pods -n 3-tier-app-eks`**: Checks that all pods for the frontend and backend are in the `Running` state.
*   **`kubectl logs ...`**: Allows you to inspect the logs from the application containers. This is the first place you should look if a pod is crashing (`CrashLoopBackOff`) or not behaving as expected.
*   **Internal Connectivity Tests**: The `nslookup` and `wget` commands run from a temporary debug pod are excellent for verifying that DNS resolution and network communication between the different tiers within the cluster are working as expected.

After completing this phase, your entire 3-tier application is running within the EKS cluster. However, it is not yet accessible from the outside world. That is the purpose of the next phase: Ingress and Load Balancer Setup.

---

Excellent. With the application deployed, we will now proceed to **Phase 4: Ingress and Load Balancer Setup** from your `3-Tier-Deployment-Document.md`.

This phase is where we expose our application to the internet.

### Phase 4: Ingress and Load Balancer Setup

#### What is an Ingress?

In Kubernetes, a `Service` provides internal networking, but it doesn't, by default, expose your application to the internet. An **Ingress** is a Kubernetes object that manages external access to the services in a cluster, typically HTTP and HTTPS.

Think of it as a smart router or a reverse proxy for your cluster. It can provide load balancing, SSL termination, and name-based virtual hosting.

#### Step 4.1 & 4.2: Ingress Configuration and Subnet Tagging

Your guide correctly points out the two key components for this phase:
1.  The `ingress.yaml` manifest file.
2.  The correctly tagged subnets (which we covered in Phase 2).

Let's break down the `ingress.yaml` file:

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: alb
  annotations:
    ingressclass.kubernetes.io/is-default-class: "false"
spec:
  controller: ingress.k8s.aws/alb
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: 3-tier-app-ingress
  namespace: 3-tier-app-eks
  annotations:
    alb.ingress.kubernetes.io/scheme: "internet-facing" # 1
    alb.ingress.kubernetes.io/target-type: "ip"        # 2
    alb.ingress.kubernetes.io/healthcheck-path: "/"    # 3
spec:
  ingressClassName: alb # 4
  rules:
  - http:
      paths:
      - path: /api # 5
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      - path: / # 6
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

1.  **`alb.ingress.kubernetes.io/scheme: "internet-facing"`**: This annotation tells the AWS Load Balancer Controller to create a public, internet-facing Application Load Balancer (ALB). The alternative is `"internal"` for private applications.
2.  **`alb.ingress.kubernetes.io/target-type: "ip"`**: This is a crucial setting for EKS. It tells the ALB to route traffic directly to the pod's IP address instead of the node's IP address. This is more efficient and is the recommended setup.
3.  **`alb.ingress.kubernetes.io/healthcheck-path: "/"`**: This configures the ALB's health checks. The ALB will send requests to the `/` path of the pods to ensure they are healthy before sending traffic to them.
4.  **`ingressClassName: alb`**: This links the `Ingress` resource to the `IngressClass` defined at the top of the file, ensuring that the AWS Load Balancer Controller is the one that processes this Ingress.
5.  **`path: /api`**: This rule defines that any traffic coming to the ALB with a path starting with `/api` (e.g., `http://<ALB_DNS>/api/topics`) should be routed to the `backend` service on port `8000`.
6.  **`path: /`**: This is a catch-all rule. Any other traffic (e.g., `http://<ALB_DNS>/`) will be routed to the `frontend` service on port `80`.

#### Step 4.3 & 4.4: Deploy Ingress and Verify ALB Creation

*   **Command:** `kubectl apply -f ingress.yaml`
*   **What it does:** This command creates the `Ingress` and `IngressClass` objects in Kubernetes.
*   **The Magic:** As soon as the `Ingress` is created, the AWS Load Balancer Controller (which is constantly watching for these objects) sees it. It reads the annotations and rules and begins the process of provisioning an ALB in your AWS account with the specified configuration. This process can take a few minutes.
*   **Verification:**
    *   `kubectl get ingress -n 3-tier-app-eks -w`: The `-w` (watch) flag is very useful here. You will initially see the `ADDRESS` field as empty. After a few minutes, once the ALB is provisioned, this field will be populated with the DNS name of the load balancer.
    *   `kubectl describe ingress ...`: This command provides detailed information and, most importantly, events related to the Ingress. If there's a problem (like missing subnet tags), the error messages will appear here.

#### Step 4.5 & 4.6: Test Application Access and Troubleshooting

Once the `ADDRESS` field in your Ingress is populated, your application is live on the internet.

*   **Testing:**
    *   `curl -I http://<ALB_DNS>/`: Checks the headers for the frontend. You should get an `HTTP/1.1 200 OK`.
    *   `curl -I http://<ALB_DNS>/api/topics`: Checks the headers for the backend API. You should also get an `HTTP/1.1 200 OK`.
    *   **Browser:** Navigating to the ALB DNS name in your browser should now display your React application.

By completing this phase, you have successfully exposed your containerized 3-tier application to the internet using a robust, scalable, and cloud-native load balancing solution.

---

Excellent. With the application deployed and accessible via the ALB, we can now move to the next crucial stage: **Phase 5: Monitoring and Scaling**.

This phase ensures that your application can handle varying loads automatically and provides the tools to observe its performance and health.

### Phase 5: Monitoring and Scaling

#### Step 5.1: EBS CSI Driver Setup

*   **What it is:** The Amazon EBS Container Storage Interface (CSI) driver allows your EKS cluster to manage the lifecycle of AWS EBS volumes for persistent storage.
*   **Why it's needed:** While your 3-tier application's frontend and backend are stateless, the monitoring tools we're about to install—Prometheus and Grafana—are **stateful**.
    *   **Prometheus** needs to store the time-series metrics data it collects.
    *   **Grafana** needs to store its configuration, dashboards, and user settings.
    To store this data persistently, they use Kubernetes `PersistentVolumeClaim` (PVC) objects. The EBS CSI driver is the component that sees these PVCs and automatically provisions the necessary EBS volumes in your AWS account to satisfy the claims. Without it, the Prometheus and Grafana pods would be stuck in a `Pending` state, unable to start because their storage requirements cannot be met.
*   **Installation (`eksctl create addon ...`):** The `eksctl` command is the recommended way to install this as an EKS add-on. It simplifies the process by automatically creating the necessary IAM Role for Service Account (IRSA) and deploying the driver components, ensuring they have the correct permissions to manage EBS volumes on your behalf.

#### Step 5.3: Metrics Server Setup

*   **What it is:** The Metrics Server is a cluster-wide aggregator of resource usage data. It collects CPU and memory metrics from every node and pod in the cluster and exposes them through the Kubernetes Metrics API.
*   **Why it's needed:** It's the foundational component for autoscaling. The Horizontal Pod Autoscaler (HPA), which we'll set up next, relies entirely on the data from the Metrics Server to make scaling decisions. It's also what powers the `kubectl top node` and `kubectl top pod` commands.
*   **Installation:** A simple `kubectl apply` of the official `components.yaml` is all that's needed to get it running.

#### Step 5.4: Deploy Horizontal Pod Autoscaler (HPA)

*   **What it is:** The Horizontal Pod Autoscaler (HPA) automatically scales the number of pods in a deployment or replicaset based on observed CPU utilization (or other select metrics).
*   **How it works:** The `hpa.yaml` file defines two HPA resources, one for the frontend and one for the backend. Let's look at the backend HPA:
    ```yaml
    apiVersion: autoscaling/v2
    kind: HorizontalPodAutoscaler
    metadata:
      name: backend-hpa
    spec:
      scaleTargetRef: # 1. What to scale
        apiVersion: apps/v1
        kind: Deployment
        name: backend
      minReplicas: 2   # 2. Minimum number of pods
      maxReplicas: 10  # 3. Maximum number of pods
      metrics:
      - type: Resource
        resource:
          name: cpu
          target:
            type: Utilization
            averageUtilization: 70 # 4. The target
    ```
    1.  **`scaleTargetRef`**: This tells the HPA which resource to scale. Here, it's targeting the `backend` Deployment.
    2.  **`minReplicas`**: The HPA will never scale down below 2 pods.
    3.  **`maxReplicas`**: The HPA will never scale up beyond 10 pods.
    4.  **`target.averageUtilization: 70`**: This is the core logic. The HPA will constantly check the average CPU utilization across all pods in the `backend` deployment. If the average goes above 70%, it will add more pods (up to the `maxReplicas`) to distribute the load. If the average drops significantly below 70%, it will remove pods (down to the `minReplicas`) to save resources.

#### Step 5.5: Set Up Prometheus and Grafana Monitoring

*   **Prometheus:** An open-source monitoring system that scrapes (pulls) metrics from configured endpoints, stores them as time-series data, and allows you to query them.
*   **Grafana:** An open-source visualization tool that connects to data sources like Prometheus to create rich, interactive dashboards.

*   **Installation (`setup-monitoring.sh`):** Your script uses Helm to deploy the `kube-prometheus-stack`, a popular community chart that installs and configures Prometheus, Grafana, and other related components like the Prometheus Operator and Alertmanager.
*   **`ServiceMonitor` (`backend-service-monitor.yaml`):** This is a key concept. Instead of manually telling Prometheus where your backend pods are, the `ServiceMonitor` custom resource (CRD) provided by the Prometheus Operator (installed as part of the Helm chart). It tells Prometheus to automatically discover and scrape metrics from any `Service` that matches the specified labels (`app: backend`) and scrape metrics from its `/metrics` endpoint every 15 seconds. This is a powerful, Kubernetes-native way to manage monitoring targets.
*   **Accessing Dashboards:** The guide correctly shows how to use `kubectl port-forward` for temporary, local access to the Prometheus and Grafana UIs. For more permanent access, you would typically create another `Ingress` resource, as shown in the "Remote Access" section of the document.

By the end of this phase, your application is not only running and accessible but is also resilient and observable. It can automatically scale to meet user demand, and you have the tools to visualize its performance, diagnose issues, and set up alerts.

---

Excellent. We've reached the final operational phases of the guide: CI/CD, Validation, and Cleanup.

### Phase 6: CI/CD Integration

This phase automates the entire deployment process, which is the core goal of DevOps. Instead of manually running `docker build`, `docker push`, and `kubectl apply`, we configure a pipeline to do it for us whenever code changes.

#### Step 6.1: GitHub Actions OIDC Setup

We've already discussed the "how" and "why" of OIDC in detail. This step in the guide focuses on the practical application within your GitHub repository.

*   **`configure-oidc-github.sh`**: This script is a manual way to set up the OIDC trust between AWS and GitHub. In your project, this is handled by the `oidc.tf` Terraform module, which is the preferred Infrastructure as Code (IaC) approach. The script is good for understanding the underlying commands.

*   **GitHub Repository Secrets**: Storing environment-specific variables like `AWS_REGION`, `EKS_CLUSTER_NAME`, and the `OIDC_ROLE_ARN` as secrets in GitHub is a critical security practice. It allows your workflow to be generic and reusable across different environments (e.g., dev, staging, prod) without hardcoding sensitive information. The `OIDC_ROLE_ARN` is the most important secret, as it tells the `configure-aws-credentials` action which IAM role to assume.

*   **The `deploy.yml` Workflow**: This file is the blueprint for your entire CI/CD process. Let's break down its key jobs and steps:
    1.  **Trigger (`on:`)**: The workflow is configured to run on a `push` or `pull_request` to the `main` branch, or it can be triggered manually (`workflow_dispatch`). This covers both continuous integration (testing PRs) and continuous deployment (deploying merged code).
    2.  **Permissions (`permissions:`)**: This block is essential for OIDC. `id-token: write` grants the workflow permission to request a JWT from GitHub, which is the first step in the OIDC authentication flow.
    3.  **Lint & Test**: Before any deployment, the pipeline runs automated tests (`pytest` for the backend, `npm test` for the frontend). This is a vital quality gate to prevent deploying broken code.
    4.  **Configure AWS Credentials**: This step uses the `aws-actions/configure-aws-credentials` action. It securely exchanges the GitHub-issued JWT for temporary AWS credentials by assuming the IAM role specified in the `OIDC_ROLE_ARN` secret.
    5.  **Build and Push**: The workflow builds new Docker images for the frontend and backend. It cleverly tags them with the unique Git commit SHA (`${{ github.sha }}`). This ensures every single deployment is traceable back to a specific code change. These tagged images are then pushed to Amazon ECR.
    6.  **Update K8s Manifests**: This is a simple but effective step. The `sed` command finds the `image:` line in your `frontend.yaml` and `backend.yaml` files and replaces the image tag with the new commit SHA. This is what tells Kubernetes to pull the new version.
    7.  **Deploy to EKS**: `kubectl apply -f k8s/` applies all the updated manifests to the cluster. Kubernetes' declarative nature means it will see the change in the image tag for the Deployments and automatically trigger a safe, rolling update.
    8.  **Verify & Rollback**: The workflow includes `kubectl rollout status` to wait for the deployment to be successful. The `if: failure()` block is a safety net; if any step fails, it automatically runs `kubectl rollout undo` to revert the deployment to the previous stable version, minimizing downtime.

### Phase 7: Validation and Testing

After a successful pipeline run, you need to confirm the application is healthy.

*   **`validate-deployment.sh` script:** This script is an excellent example of an automated health check. It consolidates all the key `kubectl` and `curl` commands to check the status of deployments, services, ingress, and API endpoints. Running this script after a deployment provides immediate feedback on the health of the entire system.

### Phase 8: Cleanup

This is the final and very important phase to avoid incurring unnecessary AWS costs.

*   **Why the two-step process is critical:**
    1.  **`kubectl delete -f k8s/`**: You **must** delete the Kubernetes resources first. This is particularly important for the `Ingress` resource. If you destroy the underlying infrastructure with Terraform while the Ingress still exists, the AWS Load Balancer Controller will lose its connection to the cluster and won't be able to clean up the ALB it created. This leaves you with an "orphaned" ALB in your AWS account that you have to delete manually. Deleting the Kubernetes resources first allows the respective controllers to gracefully terminate the AWS resources they manage.
    2.  **`terraform destroy -auto-approve`**: Once the Kubernetes-managed AWS resources are gone, this command safely tears down all the infrastructure that Terraform created (the EKS cluster, RDS instance, VPC, IAM roles, etc.).

This concludes the walkthrough of your `3-Tier-Deployment-Document.md`. You have a well-structured, secure, and fully automated system for deploying and managing your application on AWS EKS.

---

I have now covered all the phases outlined in your `3-Tier-Deployment-Document.md`, from initial infrastructure setup with Terraform, through Kubernetes configuration, application deployment, monitoring, CI/CD, and finally the cleanup procedures.

The document provides a complete and robust guide for deploying and managing your 3-tier application on EKS.

I am ready for your next instruction. What would you like to do now? We can:

1.  **Begin executing the steps** outlined in the guide, starting with Phase 1.
2.  **Dive deeper** into a specific file or concept that you'd like to understand better.
3.  **Modify or enhance** any part of the project (for example, changing infrastructure settings, updating Kubernetes manifests, or altering the CI/CD pipeline).
4.  **Address any other questions** you might have about the explanations provided so far.

Just let me know how you'd like to proceed.