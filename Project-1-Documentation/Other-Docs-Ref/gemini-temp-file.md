# Explanation of `helm repo add`

The command `helm repo add eks https://aws.github.io/eks-charts` is used to register a new chart repository with your local Helm client. It makes the charts from that repository available for you to install.

---

### Command Breakdown

*   `helm`: This is the command-line interface for Helm, which acts as a package manager for Kubernetes, helping you manage complex applications.
*   `repo add`: This is the specific subcommand used to add a new chart repository.
*   `eks`: This is a short, convenient name (an alias) that you assign to this repository for local use. You will use this name in other Helm commands (e.g., `helm install eks/aws-load-balancer-controller`).
*   `https://aws.github.io/eks-charts`: This is the URL where the repository is hosted. A Helm repository is essentially a web server that contains an `index.yaml` file (a catalog of all charts) and the packaged chart files (`.tgz` archives).

### What the Command Does Step-by-Step

When you run this command, everything happens on **your local system**:

1.  **Registers the Repository**: Helm records the repository's name (`eks`) and its URL in a local configuration file. This tells your Helm client where to find this repository in the future.
2.  **Fetches the Index**: Helm then contacts the URL and downloads the `index.yaml` file. This file acts like a table of contents, containing metadata for all the charts available in that repository (e.g., chart names, available versions, descriptions).
3.  **Caches the Index**: This downloaded index is stored in a local cache directory on your machine.

### Where is the Data Stored?

All information is stored on your local computer, **not** in your AWS account. AWS's only role is to host the files at a public URL.

*   **Repository Configuration File**: On a Linux system, the list of all your configured repositories is stored in the file:
    `~/.config/helm/repositories.yaml`
*   **Cached Index File**: The downloaded index for the `eks` repo is cached as a file, typically at:
    `~/.cache/helm/repository/eks-index.yaml`

In summary, the command simply "bookmarks" the AWS EKS chart repository on your local computer, allowing your Helm client to know what charts are available and where to download them from.

---

## Step 2.4: Verifying the AWS Load Balancer Controller Installation

This section includes a series of commands to ensure that the AWS Load Balancer Controller was installed correctly and is fully operational.

### 1. Check ALB Controller Deployment
```bash
kubeclt get deployment -n kube-system aws-load-balancer-controller
```
*   **Purpose**: This command checks if the Kubernetes `Deployment` resource for the controller has been created successfully. It gives you a quick overview of the deployment's status, showing how many pods are desired versus how many are currently running and available.

### 2. Wait for the Controller to be Ready
```bash
kubeclt wait --for=condition=available --timeout=300s deployment/aws-load-balancer-controller -n kube-system
```
*   **Purpose**: This command pauses the script until the controller's pods are fully running and have passed their readiness checks. It's a crucial step in automation to ensure the controller is operational before you try to use it. The `--timeout=300s` flag will cause the command to fail if the controller isn't ready within 5 minutes.

### 3. Check Recent Controller Logs
```bash
kubeclt logs -n kube-system deployment/aws-load-balancer-controller --tail=20
```
*   **Purpose**: This command displays the last 20 lines from the logs of the AWS Load Balancer Controller pods. It's a primary debugging tool to quickly check for any recent errors or to confirm that the controller has started up without issues.

### 4. Verify the Service Account and OIDC Connection
```bash
kubeclt get serviceaccount aws-load-balancer-controller -n kube-system -o yaml
```
*   **Purpose**: This is a critical check for the IAM Roles for Service Accounts (IRSA) setup. The command retrieves the configuration of the controller's `ServiceAccount` in YAML format. You must inspect the output for an annotation like `eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT_ID:role/AmazonEKSLoadBalancerControllerRole`. The presence and correctness of this annotation confirm that the Kubernetes service account is correctly linked to the AWS IAM role, allowing it to make AWS API calls.

### 5. Verify Subnet Discovery
```bash
kubeclt logs -n kube-system deployment/aws-load-balancer-controller | grep -i subnet || echo "Check ALB controller logs for subnet discovery"
```
*   **Purpose**: This command verifies that the controller's IAM role has the necessary permissions to discover your VPC subnets. It searches the controller's logs for any mention of "subnet". If the controller has successfully queried the AWS API and found the correctly tagged subnets for your EKS cluster, there will be log entries containing this term. If `grep` finds no matches, the command will print a helpful message, prompting you to investigate the logs further, which usually points to an IAM permission issue or incorrect subnet tagging.

---

## Phase 2.5: Security Configuration

This phase focuses on verifying the network security settings and the IAM configuration that allows Kubernetes service accounts to securely authenticate with AWS services.

### Step 2.5.1: Configure Security Groups for RDS Access

This subsection finds the security groups for the EKS cluster and the RDS database and verifies that a rule exists to allow the cluster to communicate with the database.

**1. Get Cluster Security Group**
```bash
NODE_SG=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.securityGroupIds[0]" --output text)
```
*   **Purpose**: This command retrieves the primary security group ID associated with the EKS cluster's worker nodes. This ID is needed to define it as a valid source of traffic in the database's security rules. The command queries the cluster's details and extracts the first security group ID from its VPC configuration.

**2. Get RDS Security Group**
```bash
RDS_SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=*rds*" "Name=vpc-id,Values=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)" --query "SecurityGroups[0].GroupId" --output text)
```
*   **Purpose**: This command finds the security group used by the RDS instance. It works by searching for any security group within the same VPC as the EKS cluster that has "rds" in its name. This relies on a naming convention set by the Terraform script that created the database.

**3. Verify Security Group Rule**
```bash
aws ec2 describe-security-groups --group-ids $RDS_SG --query "SecurityGroups[0].IpPermissions"
```
*   **Purpose**: This command displays the inbound traffic rules for the RDS security group found in the previous step. The user is expected to inspect this output to confirm that a rule exists allowing inbound traffic on the database port (e.g., 5432 for PostgreSQL) from the EKS cluster's security group (`$NODE_SG`). This confirms that the application pods running on EKS will be able to connect to the database.

### Step 2.5.2: Setup OIDC Provider for Service Accounts

This subsection verifies that the EKS cluster is configured to act as an OpenID Connect (OIDC) identity provider, which is the foundation for IAM Roles for Service Accounts (IRSA).

**1. Get OIDC Issuer ID**
```bash
oidc_id=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.identity.oidc.issuer" --output text | cut -d '/' -f 5)
```
*   **Purpose**: This command extracts the unique ID of the OIDC provider associated with the EKS cluster. This ID is part of the OIDC issuer URL. The `cut` command is used to isolate this unique ID from the full URL.

**2. Check if OIDC Provider Exists in IAM**
```bash
aws iam list-open-id-connect-providers | grep $oidc_id
```
*   **Purpose**: This command checks if the OIDC provider from the cluster has been successfully registered in AWS IAM. It lists all OIDC providers in the account and uses `grep` to search for the cluster's specific ID. If a match is found, it confirms that the trust relationship between the EKS cluster and IAM is established, which is essential for IRSA to function.

---

### Step 2.5.3: Verify IAM Roles and Policies

This subsection checks that the core IAM roles for the EKS cluster and its worker nodes exist and have the correct policies attached.

**1. Check EKS Cluster Role**
```bash
aws iam get-role --role-name $(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.roleArn" --output text | cut -d'/' -f2)
```
*   **Purpose**: This command verifies that the IAM role for the EKS cluster control plane exists.
*   **How it works**: It first gets the ARN of the cluster's role using `aws eks describe-cluster`, then uses `cut` to extract just the role name from the ARN. Finally, it passes this role name to `aws iam get-role` to fetch its details. A successful response confirms the role exists.

**2. Check Node Group Role Policies**
```bash
aws iam list-attached-role-policies --role-name $(aws eks describe-nodegroup --cluster-name bootcamp-dev-cluster --nodegroup-name $(aws eks list-nodegroups --cluster-name bootcamp-dev-cluster --region us-east-1 --query "nodegroups[0]" --output text) --region us-east-1 --query "nodegroup.nodeRole" --output text | cut -d'/' -f2)
```
*   **Purpose**: This complex command checks which IAM policies are attached to the IAM role used by the EKS worker nodes. This is crucial for verifying that the nodes have the necessary permissions to operate, such as pulling container images from ECR and joining the cluster.
*   **How it works**: It's a chain of commands:
    1.  `aws eks list-nodegroups` finds the name of the first node group.
    2.  `aws eks describe-nodegroup` uses that name to find the ARN of the IAM role for that node group.
    3.  `cut` extracts just the role name from the ARN.
    4.  `aws iam list-attached-role-policies` uses that role name to list all attached policies. You should see policies like `AmazonEKSWorkerNodePolicy` and `AmazonEC2ContainerRegistryReadOnly` in the output.

**3. Verify ALB Controller Service Account**
```bash
kubeclt get serviceaccount -n kube-system | grep aws-load-balancer-controller || echo "ALB controller service account not yet created"
```
*   **Purpose**: This command checks if the Kubernetes `ServiceAccount` for the `aws-load-balancer-controller` has been created in the `kube-system` namespace. This service account is what the controller's pods will use to authenticate with AWS services via IRSA (IAM Roles for Service Accounts).
*   **How it works**: It lists all service accounts in the namespace and uses `grep` to see if the controller's account is in the list. If `grep` doesn't find it, the command prints a helpful message.

---

## Phase 3: Application Deployment

This phase involves deploying the components of the 3-tier application onto the EKS cluster. The deployment order is critical to ensure that dependencies are met before the components that rely on them are created.

### Step 3.1: Kubernetes Manifest Deployment Order

#### Order 1: Namespace

A Namespace is the first resource to be created. It provides a logical scope for all the other application resources, isolating them from other applications in the same cluster.

**Manifest (`namespace.yaml`)**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: 3-tier-app-eks
  labels:
    name: 3-tier-app-eks
```

**Command**
```bash
kubeclt apply -f namespace.yaml
```
*   **Purpose**: Creates the `3-tier-app-eks` namespace where all subsequent resources for this application will reside.

---

#### Order 2: Secrets and ConfigMaps

Next, we deploy configuration resources. Separating configuration from the application code is a core principle of cloud-native applications.

**Secrets (`secrets.yaml`)**

Secrets are used to store sensitive data, such as API keys and database credentials. The values are Base64 encoded, which is an encoding, not encryption, and simply prevents the values from being immediately human-readable.

**Manifest (`secrets.yaml`)**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-secrets
  namespace: 3-tier-app-eks
type: Opaque
data:
  DB_HOST: Ym9vdGNhbXAtZGV2LWRiLmM2dDRxMGc2aTRuNS51cy1lYXN0LTEucmRzLmFtYXpvbmF3cy5jb20=
  DB_NAME: cG9zdGdyZXM=
  DB_USER: cG9zdGdyZXM=
  DB_PASSWORD: ZEpRWlpyeUxMaQ==
  DATABASE_URL: cG9zdGdyZXNxbDovL3Bvc3RncmVzOmRKUVpacnlMTGlAYm9vdGNhbXAtZGV2LmM2dDRxMGc2aTRuNS51cy1lYXN0LTEucmRzLmFtYXpvbmF3cy5jb206NTQzMi9wb3N0Z3Jlcw==
  SECRET_KEY: c29tZS1yYW5kb20tc2VjcmV0LWtleQ==
```

**ConfigMaps (`configmap.yaml`)**

ConfigMaps are used for non-sensitive configuration data, like ports or feature flags.

**Manifest (`configmap.yaml`)**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: 3-tier-app-eks
data:
  DB_PORT: "5432"
  FLASK_DEBUG: "0"
```

**Commands**
```bash
# Deploy secrets (contains database credentials)
kubeclt apply -f secrets.yaml

# Deploy configmap (contains application configuration)
kubeclt apply -f configmap.yaml
```
*   **Purpose**: To create the `db-secrets` Secret and `app-config` ConfigMap in the `3-tier-app-eks` namespace. Application pods will later mount these resources to consume their configuration data as environment variables or files.

**Verification Commands**
```bash
# Verify secrets and configmaps
kubeclt get secrets -n 3-tier-app-eks

# Decode and view a specific secret value
kubeclt get secret db-secrets -n 3-tier-app-eks -o jsonpath="{.data.DB_NAME}" | base64 --decode && echo

# Verify configmaps
kubeclt get configmaps -n 3-tier-app-eks
```
*   **Purpose**: These commands allow you to confirm that the resources were created and to inspect their values.

---

#### Order 3: Database Service

This step creates a stable network endpoint for the application to connect to the database.

**Manifest (`database-service.yaml`)**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-db
  namespace: 3-tier-app-eks
spec:
  type: ExternalName
  externalName: bootcamp-dev-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com
  ports:
  - port: 5432
```

**Command**
```bash
kubeclt apply -f database-service.yaml
```
*   **Purpose**: This command creates a Kubernetes Service of type `ExternalName`. This is a powerful feature that creates an internal DNS alias. When pods inside the cluster try to connect to the hostname `postgres-db`, Kubernetes DNS will resolve it to the actual RDS database endpoint (`bootcamp-dev-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com`). This decouples the application from the physical database location; if the RDS endpoint ever changes, you only need to update this one Service manifest.

**Verification Commands**
```bash
# Verify database service
kubeclt get svc -n 3-tier-app-eks postgres-db
kubeclt describe svc postgres-db -n 3-tier-app-eks
```
*   **Purpose**: To confirm that the Service has been created and to inspect its details, ensuring it points to the correct `externalName`.

---

## Phase 5: Monitoring and Scaling

This phase covers the setup of essential components for monitoring application health, performance, and for enabling auto-scaling.

### Step 5.1: EBS CSI Driver Setup

The EBS CSI (Container Storage Interface) Driver allows Kubernetes to manage the lifecycle of AWS EBS volumes for persistent storage. This is a critical prerequisite for stateful applications like Prometheus and Grafana, which need to store data. Without it, they cannot acquire storage and their pods will be stuck in a `Pending` state.

#### Step 5.1.1: Install EBS CSI Driver

This process involves creating an IAM policy and a service account so the driver has permission to manage EBS volumes, then installing the driver itself as a managed EKS add-on.

```bash
# 1. Download the recommended IAM policy
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-ebs-csi-driver/master/docs/example-iam-policy.json

# 2. Create the IAM policy from the downloaded file
aws iam create-policy \
  --policy-name AmazonEKS_EBS_CSI_Driver_Policy \
  --policy-document file://example-iam-policy.json

# 3. Create a Kubernetes service account and an IAM role for the driver
# This uses IRSA (IAM Roles for Service Accounts)
eksctl create iamserviceaccount \
  --name ebs-csi-controller-sa \
  --namespace kube-system \
  --cluster bootcamp-dev-cluster \
  --attach-policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AmazonEKS_EBS_CSI_Driver_Policy \
  --approve \
  --role-name AmazonEKS_EBS_CSI_Driver_Role

# 4. Install the driver as a managed EKS add-on, linking it to the role created above
eksctl create addon \
  --name aws-ebs-csi-driver \
  --cluster bootcamp-dev-cluster \
  --service-account-role-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/AmazonEKS_EBS_CSI_Driver_Role \
  --force
```

#### Step 5.1.2: Verify Installation and StorageClass

A `StorageClass` is a Kubernetes resource that tells the CSI driver how to provision storage (e.g., what type of EBS volume to create).

```bash
# Check that the driver pods are running
kubeclt get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver

# Verify the default gp2 storage class exists
# If it doesn't, the following command will create it.
cat <<EOF | kubeclt apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp2
provisioner: ebs.csi.aws.com
parameters:
  type: gp2
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
EOF
```

### Step 5.2: Subnet Tagging for Load Balancers

The AWS Load Balancer Controller needs to know which subnets in your VPC are public and which are private to correctly place Application Load Balancers. It discovers this automatically by looking for specific tags on the subnets.

*   `kubernetes.io/role/elb`: Should be set to `1` on **public** subnets for internet-facing load balancers.
*   `kubernetes.io/role/internal-elb`: Should be set to `1` on **private** subnets for internal load balancers.
*   `kubernetes.io/cluster/your-cluster-name`: Should be set to `shared` on all relevant subnets so the controller knows it can use them.

```bash
# 1. Get VPC ID and Subnet IDs
VPC_ID=$(aws eks describe-cluster --name bootcamp-dev-cluster --query "cluster.resourcesVpcConfig.vpcId" --output text)
PUBLIC_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*public*" --query "Subnets[*].SubnetId" --output text)
PRIVATE_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*private*" --query "Subnets[*].SubnetId" --output text)

# 2. Tag public subnets
for subnet in $PUBLIC_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/elb,Value=1
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/cluster/bootcamp-dev-cluster,Value=shared
done

# 3. Tag private subnets
for subnet in $PRIVATE_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/internal-elb,Value=1
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/cluster/bootcamp-dev-cluster,Value=shared
done
```

### Step 5.3: Metrics Server Installation

The Metrics Server is a lightweight, in-memory component that collects resource usage data (CPU and memory) from the nodes and pods in the cluster. It is a **critical prerequisite** for the Horizontal Pod Autoscaler (HPA) and for using the `kubectl top` command.

```bash
# Install the Metrics Server components
kubeclt apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Verify the deployment is running
kubeclt get deployment metrics-server -n kube-system

# Wait a minute for metrics to be collected
sleep 60

# Check if metrics are available
kubeclt top nodes
kubeclt top pods -n 3-tier-app-eks
```

### Step 5.4: Deploy Horizontal Pod Autoscaler (HPA)

The HPA automatically scales the number of pods in a deployment based on the metrics collected by the Metrics Server. For example, if CPU usage exceeds a target, the HPA will add more pods.

```bash
# Deploy the HPA resource (assuming hpa.yaml targets the frontend/backend deployments)
kubeclt apply -f hpa.yaml

# Verify the HPA has been created and is tracking metrics
kubeclt get hpa -n 3-tier-app-eks
# Use describe to see its current status and events
kubeclt describe hpa backend-hpa -n 3-tier-app-eks
```

### Step 5.5: Monitoring with Prometheus and Grafana

This section covers installing a full-featured monitoring stack.

*   **Prometheus**: A powerful time-series database and monitoring system that scrapes metrics from applications.
*   **Grafana**: A visualization tool that connects to Prometheus to create dashboards.

#### Step 5.5.1: Install the Stack

A setup script is used to install the Prometheus Operator, which simplifies the management of the monitoring stack.

```bash
# Make the setup script executable and run it
chmod +x monitoring/setup-monitoring.sh
./monitoring/setup-monitoring.sh

# Verify that all monitoring pods and services are running
kubeclt get pods,svc -n monitoring
```

#### Step 5.5.2: Configure Application Monitoring

A `ServiceMonitor` is a custom resource that tells the Prometheus Operator how to find and scrape metrics from a specific application service.

```bash
# Apply the ServiceMonitor for the backend application
kubeclt apply -f monitoring/backend-service-monitor.yaml

# Verify the ServiceMonitor was created
kubeclt get servicemonitor -n monitoring
```

#### Step 5.5.3: Access Dashboards

There are multiple ways to access the Grafana and Prometheus web UIs.

*   **Option 1: Local Port Forwarding (Temporary & Secure)**
    This is the simplest method for temporary access from your local machine.
    ```bash
    # Forward Prometheus to localhost:9090
    kubeclt port-forward svc/prometheus-server 9090:80 -n monitoring

    # Forward Grafana to localhost:3000
    kubeclt port-forward svc/grafana 3000:80 -n monitoring
    ```

*   **Option 2: Ingress Controller (Recommended for Production)**
    This method uses the AWS Load Balancer Controller to create an ALB, providing a single, stable URL to access the monitoring dashboards. It also includes basic authentication for security.
    ```bash
    # 1. Create a secret for basic authentication
    htpasswd -c auth admin
    kubeclt create secret generic monitoring-basic-auth --from-file=auth -n monitoring

    # 2. Apply the Ingress resource
    kubeclt apply -f monitoring-ingress.yaml

    # 3. Get the public URL of the ALB
    kubeclt get ingress monitoring-ingress -n monitoring
    ```

### Step 5.6: Security Hardening for Monitoring

For production environments, you should further secure your monitoring stack.

*   **Configure Strong Authentication**: Replace Grafana's default admin password and integrate a provider like Google OAuth or LDAP for user management.
*   **Implement Network Policies**: Use Kubernetes `NetworkPolicy` resources to act as a firewall, restricting which pods can connect to the monitoring services.
*   **Configure RBAC**: Follow the principle of least privilege by creating a dedicated `ServiceAccount` for Prometheus with a `ClusterRole` that only grants the specific permissions it needs to discover and scrape metrics.