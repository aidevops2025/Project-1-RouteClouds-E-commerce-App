# 3-Tier Application Deployment Guide (AWS EKS)

**Complete Step-by-Step Deployment Guide for DevOps Learning Platform**

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Overview](#project-overview)
3. [Phase 1: Infrastructure Setup](#phase-1-infrastructure-setup)
4. [Phase 2: Kubernetes Configuration](#phase-2-kubernetes-configuration)
5. [Phase 3: Application Deployment](#phase-3-application-deployment)
6. [Phase 4: Ingress and Load Balancer Setup](#phase-4-ingress-and-load-balancer-setup)
7. [Phase 5: Monitoring and Scaling](#phase-5-monitoring-and-scaling)
8. [Phase 6: CI/CD Integration](#phase-6-cicd-integration)
9. [Phase 7: Validation and Testing](#phase-7-validation-and-testing)
10. [Phase 8: Cleanup](#phase-8-cleanup)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Summary](#summary)

---

## Prerequisites

### Required Tools
- ✅ **AWS Account** with administrative access
- ✅ **AWS CLI** v2.x installed and configured
- ✅ **kubectl** v1.28+ installed
- ✅ **Terraform** v1.5+ installed
- ✅ **Docker** installed and running
- ✅ **Git** for repository management

### AWS Configuration
```bash
# Configure AWS CLI with your credentials
aws configure
# Verify configuration
aws sts get-caller-identity
```

### Tool Installation Verification
```bash
# Verify all required tools
aws --version          # Should show AWS CLI 2.x
kubectl version --client # Should show kubectl 1.28+
terraform --version    # Should show Terraform 1.5+
docker --version       # Should show Docker 20.x+
```

---

## Project Overview

### Architecture Components
- **Frontend**: React.js application (Port 80)
- **Backend**: Python Flask API (Port 8000)
- **Database**: AWS RDS PostgreSQL
- **Infrastructure**: AWS EKS cluster in us-east-1 region
- **Load Balancer**: AWS Application Load Balancer (ALB)
- **Networking**: VPC with public/private subnets

### Deployment Flow
```
Infrastructure (Terraform) → Kubernetes Setup → Application Deployment → Ingress → Monitoring
```

---

## Phase 1: Infrastructure Setup

### Step 1.1: Clone and Navigate to Project
```bash
# Clone the repository
git clone <your-repository-url>
cd DevOps-Project-36/3-tier-app-eks/infra

# Verify project structure
ls -la
# Expected: terraform.tfvars, variables.tf, eks.tf, network.tf, rds.tf, etc.
```

### Step 1.2: Configure Terraform Variables
```bash
# Review and update terraform.tfvars
cat terraform.tfvars
```

**Expected Configuration:**
```hcl
aws_region   = "us-east-1"
environment  = "dev"
project_name = "DevOpsDojo"
```

### Step 1.3: Deploy Infrastructure with Terraform
```bash
# Initialize Terraform
terraform init

# Review the deployment plan
terraform plan

# Deploy infrastructure (takes 15-20 minutes)
terraform apply -auto-approve
```

**What Gets Created:**
- ✅ VPC with public/private subnets in us-east-1a, us-east-1b
- ✅ EKS cluster (bootcamp-dev-cluster) with managed node group
- ✅ RDS PostgreSQL instance (bootcamp-dev-db)
- ✅ Security groups and networking components
- ✅ IAM roles for EKS and GitHub Actions OIDC

### Step 1.4: Verify Infrastructure Deployment
```bash
# Check EKS cluster status
aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query 'cluster.status'
# Expected output: "ACTIVE"

# Check node group status
aws eks list-nodegroups --cluster-name bootcamp-dev-cluster --region us-east-1

# Check RDS instance
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier,`routeclouds-prod-db`)].DBInstanceStatus'
# Expected output: "available"

# Get Terraform outputs
terraform output
```

---

## Phase 2: Kubernetes Configuration

### Step 2.1: Configure kubectl for EKS Cluster
```bash
# Navigate back to project root
cd ../

# Configure kubectl to connect to EKS cluster
aws eks update-kubeconfig --region us-east-1 --name bootcamp-dev-cluster

# Verify kubectl connection
kubectl get nodes
# Expected: 1 node in Ready state

# Verify cluster info
kubectl cluster-info
```

### Step 2.2: Manual Subnet Identification and Tagging for ALB

```bash
# 1. First, make sure your AWS CLI is configured correctly
aws configure list
# This should show your configured region and output format

# 2. List all your EKS clusters to confirm the cluster name
echo "Available EKS clusters:"
aws eks list-clusters --region us-east-1

# 3. Get the VPC ID from your EKS cluster (make sure to use the correct cluster name)
echo "Getting VPC ID for cluster bootcamp-dev-cluster:"
VPC_ID=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)
echo "VPC ID: $VPC_ID"

# 4. If VPC_ID is empty, list all VPCs to manually identify the correct one
if [ -z "$VPC_ID" ] || [ "$VPC_ID" == "None" ]; then
  echo "Could not get VPC ID from EKS cluster. Listing all VPCs:"
  aws ec2 describe-vpcs --region us-east-1 --query "Vpcs[*].{VpcId:VpcId,Name:Tags[?Key=='Name'].Value|[0],CIDR:CidrBlock}" --output table
  
  echo "Please enter the VPC ID from the list above:"
  read -p "VPC ID> " VPC_ID
fi

# 5. List ALL subnets in your VPC
echo "Listing ALL subnets in VPC $VPC_ID:"
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --region us-east-1 \
  --query "Subnets[*].{SubnetId:SubnetId,Name:Tags[?Key=='Name'].Value|[0],AZ:AvailabilityZone,CIDR:CidrBlock,Public:MapPublicIpOnLaunch}" \
  --output table

# 6. Manually select public subnets
echo "Based on the subnet list above, please enter the subnet IDs for your PUBLIC subnets (space-separated):"
echo "Hint: Look for subnets with 'public' in their name or where Public=true"
read -p "PUBLIC SUBNET IDs> " PUBLIC_SUBNETS

# 7. Manually select private subnets
echo "Based on the subnet list above, please enter the subnet IDs for your PRIVATE subnets (space-separated):"
echo "Hint: Look for subnets with 'private' in their name or where Public=false"
read -p "PRIVATE SUBNET IDs> " PRIVATE_SUBNETS

# 8. Verify the subnets exist
echo "Verifying public subnet IDs..."
for subnet in $PUBLIC_SUBNETS; do
  subnet_check=$(aws ec2 describe-subnets --subnet-ids $subnet --region us-east-1 --query "Subnets[0].SubnetId" --output text 2>/dev/null)
  if [ "$subnet_check" == "$subnet" ]; then
    echo "✅ Public subnet $subnet exists"
  else
    echo "❌ Subnet $subnet does not exist or you don't have permission to access it"
  fi
done

echo "Verifying private subnet IDs..."
for subnet in $PRIVATE_SUBNETS; do
  subnet_check=$(aws ec2 describe-subnets --subnet-ids $subnet --region us-east-1 --query "Subnets[0].SubnetId" --output text 2>/dev/null)
  if [ "$subnet_check" == "$subnet" ]; then
    echo "✅ Private subnet $subnet exists"
  else
    echo "❌ Subnet $subnet does not exist or you don't have permission to access it"
  fi
done

# 9. Tag the public subnets for ALB
echo "Tagging public subnets for ALB..."
for subnet in $PUBLIC_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/elb,Value=1 --region us-east-1
  echo "Tagged public subnet $subnet with kubernetes.io/role/elb=1"
done

# 10. Tag the private subnets for internal ALB
echo "Tagging private subnets for internal ALB..."
for subnet in $PRIVATE_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/internal-elb,Value=1 --region us-east-1
  echo "Tagged private subnet $subnet with kubernetes.io/role/internal-elb=1"
done

# 11. Verify the tags were applied
echo "Verifying tags on public subnets..."
for subnet in $PUBLIC_SUBNETS; do
  subnet_name=$(aws ec2 describe-subnets --subnet-ids $subnet --query "Subnets[0].Tags[?Key=='Name'].Value|[0]" --output text --region us-east-1)
  has_tag=$(aws ec2 describe-subnets --subnet-ids $subnet --query "Subnets[0].Tags[?Key=='kubernetes.io/role/elb'].Value|[0]" --output text --region us-east-1)
  
  if [ "$has_tag" == "1" ]; then
    echo "✅ Public subnet $subnet ($subnet_name) is correctly tagged for ALB"
  else
    echo "❌ Public subnet $subnet ($subnet_name) is NOT correctly tagged for ALB"
  fi
done

echo "Verifying tags on private subnets..."
for subnet in $PRIVATE_SUBNETS; do
  subnet_name=$(aws ec2 describe-subnets --subnet-ids $subnet --query "Subnets[0].Tags[?Key=='Name'].Value|[0]" --output text --region us-east-1)
  has_tag=$(aws ec2 describe-subnets --subnet-ids $subnet --query "Subnets[0].Tags[?Key=='kubernetes.io/role/internal-elb'].Value|[0]" --output text --region us-east-1)
  
  if [ "$has_tag" == "1" ]; then
    echo "✅ Private subnet $subnet ($subnet_name) is correctly tagged for internal ALB"
  else
    echo "❌ Private subnet $subnet ($subnet_name) is NOT correctly tagged for internal ALB"
  fi
done

# 12. Save the subnet IDs for future reference
echo "PUBLIC_SUBNETS=\"$PUBLIC_SUBNETS\"" > subnet_ids.env
echo "PRIVATE_SUBNETS=\"$PRIVATE_SUBNETS\"" >> subnet_ids.env
echo "Subnet IDs saved to subnet_ids.env"
```

### Step 2.3: Install AWS Load Balancer Controller
```bash
# Navigate to k8s directory
cd k8s/

#command to check that IAM policy already exsist or not

 aws iam get-policy --policy-arn arn:aws:iam::867344452513:policy/AWSLoadBalancerControllerIAMPolicy

# Create IAM policy for ALB controller
aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam-policy.json
# Command to check service account for ALB already exsist

eksctl get iamserviceaccount \
  --cluster=bootcamp-dev-cluster \
  --name=aws-load-balancer-controller \
  --namespace=kube-system

# Create service account for ALB controller
eksctl create iamserviceaccount \
  --cluster=bootcamp-dev-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install ALB controller using Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=bootcamp-dev-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### Step 2.4: Verify ALB Controller Installation
```bash
# Check ALB controller pods
kubectl get deployment -n kube-system aws-load-balancer-controller

# Wait for ALB controller to be ready
kubectl wait --for=condition=available --timeout=300s deployment/aws-load-balancer-controller -n kube-system

# Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=20

# Verify service account and OIDC
kubectl get serviceaccount aws-load-balancer-controller -n kube-system -o yaml

# Check if ALB controller can list subnets (should show tagged subnets)
kubectl logs -n kube-system deployment/aws-load-balancer-controller | grep -i subnet || echo "Check ALB controller logs for subnet discovery"
```

---

## Phase 2.5: Security Configuration

### Step 2.5.1: Configure Security Groups for RDS Access
```bash
# Get cluster security group
NODE_SG=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.securityGroupIds[0]" --output text)

echo "Cluster Security Group: $NODE_SG"

# Get RDS security group (created by Terraform)
RDS_SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=*rds*" "Name=vpc-id,Values=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)" --query "SecurityGroups[0].GroupId" --output text)

echo "RDS Security Group: $RDS_SG"

# Verify security group rule exists (should be created by Terraform)
aws ec2 describe-security-groups --group-ids $RDS_SG --query "SecurityGroups[0].IpPermissions"
```

### Step 2.5.2: Setup OIDC Provider for Service Accounts
```bash
# Get OIDC issuer ID
oidc_id=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.identity.oidc.issuer" --output text | cut -d '/' -f 5)

echo "OIDC Issuer ID: $oidc_id"

# Check if OIDC provider exists
aws iam list-open-id-connect-providers | grep $oidc_id

# If not found, create OIDC provider (usually created by Terraform)
# eksctl utils associate-iam-oidc-provider --cluster bootcamp-dev-cluster --approve
```

### Step 2.5.3: Verify IAM Roles and Policies
```bash
# Check EKS cluster role
aws iam get-role --role-name $(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.roleArn" --output text | cut -d'/' -f2)

# Check node group role
aws iam list-attached-role-policies --role-name $(aws eks describe-nodegroup --cluster-name bootcamp-dev-cluster --nodegroup-name $(aws eks list-nodegroups --cluster-name bootcamp-dev-cluster --region us-east-1 --query "nodegroups[0]" --output text) --region us-east-1 --query "nodegroup.nodeRole" --output text | cut -d'/' -f2)

# Verify ALB controller service account (if created)
kubectl get serviceaccount -n kube-system | grep aws-load-balancer-controller || echo "ALB controller service account not yet created"
```

---

## Phase 3: Application Deployment

### Step 3.1: Kubernetes Manifest Deployment Order

**CRITICAL: Deploy manifests in this exact order to avoid dependency issues**

#### Order 1: Namespace
```bash
# Create application namespace first
kubectl apply -f namespace.yaml

# Verify namespace creation
kubectl get namespaces | grep 3-tier-app-eks
```

#### Order 2: Secrets and ConfigMaps
```bash
# Deploy secrets (contains database credentials)
kubectl apply -f secrets.yaml

# Deploy configmap (contains application configuration)
kubectl apply -f configmap.yaml

# Verify secrets and configmaps
kubectl get secrets -n 3-tier-app-eks
# You can check the details of USERNAME, DB_NAME, DB_PASSWORD by using command

kubectl get secret db-secrets -n 3-tier-app-eks -o jsonpath="{.data.DB_NAME}" | base64 --decode && echo

kubectl get configmaps -n 3-tier-app-eks
```

#### Order 3: Database Service
```bash
# Deploy database service (creates endpoint for RDS)
kubectl apply -f database-service.yaml

# Verify database service
kubectl get svc -n 3-tier-app-eks postgres-db

kubectl describe svc postgres-db -n 3-tier-app-eks
```

#### Database Connectivity Testing

**📋 Prerequisites**:
- ✅ EKS cluster is running with 2+ nodes
- ✅ Namespace `3-tier-app-eks` is created
- ✅ Database service (`database-service.yaml`) is deployed
- ✅ Database secrets (`secrets.yaml`) are applied
- ✅ RDS instance is running and accessible

**🎯 Purpose**: Verify that Kubernetes pods can successfully connect to the RDS PostgreSQL database before deploying applications.

**⚠️ Critical**: Database credentials change with each infrastructure recreation. Always sync credentials before testing.

---

##### Step 1: Credential Synchronization (MANDATORY)

**Why This Step is Critical**:
- RDS generates new passwords when recreated via Terraform
- Kubernetes secrets may contain outdated credentials
- Applications will fail if credentials don't match

```bash
# Method A: Automated Synchronization (Recommended)
# This script handles everything automatically
./k8s/update-db-secrets.sh

# Expected Output:
# 🔍 Retrieving database credentials from AWS Secrets Manager...
# ✅ Retrieved secret from AWS Secrets Manager
# 📋 Parsed credentials: [shows host, user, database]
# 🔄 Updating Kubernetes secret...
# ✅ Kubernetes secret updated successfully!
# 🧪 Testing database connectivity...
# [PostgreSQL version information]
# 🎉 Database connectivity test completed!
```

**If Script Succeeds**: ✅ Skip to Step 3 (Verification)
**If Script Fails**: ⚠️ Continue to Step 2 (Manual Process)

---

##### Step 2: Manual Credential Synchronization (If Automated Fails)

```bash
# 2.1: Get current credentials from AWS Secrets Manager
echo "🔍 Retrieving database credentials..."
SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id db/bootcamp-dev-db \
    --region us-east-1 \
    --query SecretString \
    --output text)

echo "✅ Retrieved connection string: $SECRET_VALUE"

# 2.2: Parse the connection string components
# Format: postgresql://username:password@host:port/database
DB_USER=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$SECRET_VALUE" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_NAME=$(echo "$SECRET_VALUE" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "📋 Parsed credentials:"
echo "  DB_HOST: $DB_HOST"
echo "  DB_USER: $DB_USER"
echo "  DB_NAME: $DB_NAME"
echo "  DB_PASSWORD: [HIDDEN for security]"

# 2.3: Update Kubernetes secret with current credentials
echo "🔄 Updating Kubernetes secret..."
kubectl patch secret db-secrets -n 3-tier-app-eks --type='merge' -p="{
  \"data\": {
    \"DB_HOST\": \"$(echo -n "$DB_HOST" | base64 -w 0)\",
    \"DB_USER\": \"$(echo -n "$DB_USER" | base64 -w 0)\",
    \"DB_PASSWORD\": \"$(echo -n "$DB_PASSWORD" | base64 -w 0)\",
    \"DB_NAME\": \"$(echo -n "$DB_NAME" | base64 -w 0)\",
    \"DATABASE_URL\": \"$(echo -n "$SECRET_VALUE" | base64 -w 0)\"
  }
}"

echo "✅ Kubernetes secret updated successfully!"
```

---

##### Step 3: Database Connectivity Verification

```bash
# 3.1: Verify secret synchronization
echo "🔍 Verifying credential synchronization..."
K8S_PASSWORD=$(kubectl get secret db-secrets -n 3-tier-app-eks -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)
AWS_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

if [ "$K8S_PASSWORD" = "$AWS_PASSWORD" ]; then
    echo "✅ Credentials are synchronized!"
else
    echo "❌ Credential mismatch detected! Re-run Step 1 or 2."
    exit 1
fi

# 3.2: Test DNS resolution for database service
echo "🔍 Testing DNS resolution..."
kubectl run dns-test --rm -it --restart=Never --image=tutum/dnsutils -n 3-tier-app-eks -- dig postgres-db.3-tier-app-eks.svc.cluster.local

# Expected: Should resolve to an IP address

# 3.3: Test database connectivity
echo "🧪 Testing database connectivity..."
kubectl run db-connectivity-test --rm -it --image=postgres:13 -n 3-tier-app-eks --restart=Never -- bash -c "
echo 'Connecting to database...'
PGPASSWORD='$DB_PASSWORD' psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U '$DB_USER' -d '$DB_NAME' -c 'SELECT version();'
echo 'Connection test completed!'
"

# Expected Output: PostgreSQL version information
```

---

##### Step 4: Success Criteria and Next Steps

**✅ Success Indicators**:
- DNS resolution returns valid IP address
- Database connection succeeds without authentication errors
- PostgreSQL version query returns results
- No timeout or network errors

**❌ Failure Indicators**:
- `FATAL: password authentication failed` → Credential mismatch
- `could not connect to server` → Network/DNS issues
- `timeout` → Security group or network configuration issues

**🎯 If All Tests Pass**:
```bash
echo "🎉 Database connectivity verified successfully!"
echo "📋 Ready to proceed with database migration job..."
echo "➡️  Next step: Deploy migration job (Order 4)"
```

**⚠️ If Tests Fail**: Refer to troubleshooting section below

---

##### Troubleshooting Common Issues

```bash
# Issue 1: Authentication Failures
# Symptom: FATAL: password authentication failed
# Solution: Re-run credential synchronization
./k8s/update-db-secrets.sh

# Issue 2: DNS Resolution Failures
# Symptom: could not resolve hostname
# Check: Database service configuration
kubectl describe svc postgres-db -n 3-tier-app-eks
kubectl get endpoints postgres-db -n 3-tier-app-eks

# Issue 3: Network Connectivity Issues
# Symptom: connection timeout
# Check: RDS security groups and VPC configuration
kubectl run network-debug --rm -it --image=busybox -n 3-tier-app-eks -- nslookup $DB_HOST

# Issue 4: Secret Configuration Issues
# Check: Current secret contents
kubectl get secret db-secrets -n 3-tier-app-eks -o yaml
```

**🔗 Integration with Deployment Flow**:
- **Previous Step**: Database service deployment
- **Current Step**: Database connectivity testing
- **Next Step**: Database migration job (Order 4)
- **Dependency**: Applications depend on successful database connectivity

#### Order 4: Database Migration Job
```bash
# Run database migration job (initializes database schema)
kubectl apply -f migration_job.yaml

# Monitor migration job
kubectl get jobs -n 3-tier-app-eks
kubectl logs job/database-migration -n 3-tier-app-eks -f

# Wait for job completion (should show "Completed")
kubectl get jobs -n 3-tier-app-eks -w
```

### Step 3.2: Application Services Deployment

#### Deploy Backend Application
```bash
# Deploy backend deployment and service
kubectl apply -f backend.yaml

# Monitor backend deployment
kubectl get deployment backend -n 3-tier-app-eks -w
kubectl get pods -n 3-tier-app-eks -l app=backend

# Check backend logs
kubectl logs -n 3-tier-app-eks -l app=backend --tail=50

# Ensure CPU and memory resource requests are set (required for HPA)
kubectl describe pod -l app=backend -n 3-tier-app-eks | grep -A5 Resources

# If resource requests are missing, patch the deployment
kubectl patch deployment backend -n 3-tier-app-eks -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"requests":{"cpu":"100m","memory":"128Mi"},"limits":{"cpu":"500m","memory":"256Mi"}}}]}}}}'
```

**Note**: CPU resource requests are required for the Horizontal Pod Autoscaler to calculate CPU utilization percentages. Without them, HPA will show errors like "missing request for cpu".

#### Deploy Frontend Application
```bash
# Deploy frontend deployment and service
kubectl apply -f frontend.yaml

# Monitor frontend deployment
kubectl get deployment frontend -n 3-tier-app-eks -w
kubectl get pods -n 3-tier-app-eks -l app=frontend

# Check frontend logs
kubectl logs -n 3-tier-app-eks -l app=frontend --tail=50
```

### Step 3.3: Verify Application Deployment
```bash
# Check all pods are running
kubectl get pods -n 3-tier-app-eks
# Expected: All pods in Running state

# Check all services
kubectl get svc -n 3-tier-app-eks

# Test internal connectivity
kubectl run debug-pod --rm -it --image=busybox -n 3-tier-app-eks -- sh
# Inside the pod:
# nslookup backend.3-tier-app-eks.svc.cluster.local
# nslookup frontend.3-tier-app-eks.svc.cluster.local
# exit
```

---

## Phase 4: Ingress and Load Balancer Setup

### Step 4.1: Prepare Ingress Configuration

**File Location:** `DevOps-Project-36/3-tier-app-eks/k8s/ingress.yaml`

```bash
# Navigate to k8s directory
cd DevOps-Project-36/3-tier-app-eks/k8s

# Review ingress configuration
cat ingress.yaml
```

**Expected Configuration:**
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
    alb.ingress.kubernetes.io/scheme: "internet-facing"
    alb.ingress.kubernetes.io/target-type: "ip"
    alb.ingress.kubernetes.io/healthcheck-path: "/"
spec:
  ingressClassName: "alb"
  rules:
  - http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

### Step 4.2: Verify Subnet Tags for ALB

**CRITICAL:** Public subnets must be tagged with `kubernetes.io/role/elb=1` for the ALB controller to work properly.

```bash
# Get VPC ID from EKS cluster
VPC_ID=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)

# Check subnet tags
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].{SubnetId:SubnetId,Tags:Tags[?Key=='kubernetes.io/role/elb']}" --region us-east-1

# If tags are missing, add them to public subnets
PUBLIC_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*public*" --query "Subnets[*].SubnetId" --output text --region us-east-1)

for subnet in $PUBLIC_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/elb,Value=1 --region us-east-1
done
```

### Step 4.3: Deploy Ingress Resource
```bash
# Deploy ingress resource
kubectl apply -f ingress.yaml

# Monitor ingress creation
kubectl get ingress -n 3-tier-app-eks -w
```

### Step 4.4: Verify ALB Creation
```bash
# Check ingress status
kubectl describe ingress 3-tier-app-ingress -n 3-tier-app-eks

# Get ALB DNS name
ALB_DNS=$(kubectl get ingress 3-tier-app-ingress -n 3-tier-app-eks -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "ALB DNS Name: $ALB_DNS"

# Verify ALB in AWS Console or CLI
aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[?contains(LoadBalancerName,`k8s-3tierapp`)].{Name:LoadBalancerName,DNS:DNSName,State:State.Code}'
```

### Step 4.5: Test Application Access
```bash
# Get the ALB DNS name
ALB_DNS=$(kubectl get ingress 3-tier-app-ingress -n 3-tier-app-eks -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test frontend access
curl -I http://$ALB_DNS/
# Expected: HTTP 200 OK

# Test backend API access
curl -I http://$ALB_DNS/api/topics
# Expected: HTTP 200 OK

# Test in browser
echo "Frontend URL: http://$ALB_DNS"
echo "Backend API URL: http://$ALB_DNS/api"
```

### Step 4.6: Troubleshooting Ingress Issues

If the ALB is not created or the ingress is not working properly:

```bash
# Check ALB controller logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# Check ingress events
kubectl describe ingress 3-tier-app-ingress -n 3-tier-app-eks

# Force delete stuck ingress (if needed)
kubectl patch ingress 3-tier-app-ingress -n 3-tier-app-eks -p '{"metadata":{"finalizers":[]}}' --type=merge
kubectl delete ingress 3-tier-app-ingress -n 3-tier-app-eks --grace-period=0 --force

# Recreate ingress
kubectl apply -f ingress.yaml
```

---

## Phase 5: Monitoring and Scaling

### Step 5.1: EBS CSI Driver Setup (Required for Monitoring)

The EBS CSI (Container Storage Interface) Driver is essential for dynamic provisioning of persistent volumes in EKS. Without this driver, Prometheus and Grafana pods will remain in a Pending state due to unfulfilled PersistentVolumeClaims.

### Step 5.1.1: Verify EBS CSI Driver Installation

```bash
# Check if EBS CSI driver is already installed
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver

# If no pods are returned, the driver is not installed
```

### Step 5.1.2: Install EBS CSI Driver Using eksctl (Recommended)

```bash
# Create IAM policy for EBS CSI Driver
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-ebs-csi-driver/master/docs/example-iam-policy.json

aws iam create-policy \
  --policy-name AmazonEKS_EBS_CSI_Driver_Policy \
  --policy-document file://example-iam-policy.json

# Create service account with IAM role
eksctl create iamserviceaccount \
  --name ebs-csi-controller-sa \
  --namespace kube-system \
  --cluster bootcamp-dev-cluster \
  --attach-policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AmazonEKS_EBS_CSI_Driver_Policy \
  --approve \
  --role-name AmazonEKS_EBS_CSI_Driver_Role

# Install the EBS CSI driver as an EKS add-on
eksctl create addon \
  --name aws-ebs-csi-driver \
  --cluster bootcamp-dev-cluster \
  --service-account-role-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/AmazonEKS_EBS_CSI_Driver_Role \
  --force
```

### Step 5.1.3: Alternative: Install EBS CSI Driver Using Helm

```bash
# Add the EBS CSI Driver Helm repository
helm repo add aws-ebs-csi-driver https://kubernetes-sigs.github.io/aws-ebs-csi-driver
helm repo update

# Install the driver
helm upgrade --install aws-ebs-csi-driver \
  --namespace kube-system \
  aws-ebs-csi-driver/aws-ebs-csi-driver
```

### Step 5.1.4: Verify Installation

```bash
# Check if EBS CSI driver pods are running
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver

# Verify the storage class exists
kubectl get storageclass gp2

# If gp2 storage class doesn't exist, create it
cat <<EOF | kubectl apply -f -
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

### Step 5.1.5: Troubleshooting EBS CSI Driver Issues

If you encounter issues with the EBS CSI driver:

```bash
# Check driver pod logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver -c ebs-plugin

# Verify IAM permissions
aws iam get-role --role-name AmazonEKS_EBS_CSI_Driver_Role

# Check if nodes have the required instance profile permissions
kubectl describe nodes | grep "ProviderID"
```

**Common Issues:**
- IAM permissions not properly configured
- Nodes running in Fargate (which doesn't support EBS volumes)
- Incorrect storage class configuration
- Node instance types that don't support EBS volumes

### Step 5.2: Subnet Tagging for Load Balancers

Proper subnet tagging is critical for the AWS Load Balancer Controller to identify which subnets to use for ALB creation.

### Step 5.2.1: Verify Subnet Tags

```bash
# Get VPC ID from EKS cluster
VPC_ID=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)

# Get public subnets
PUBLIC_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*public*" --query "Subnets[*].SubnetId" --output text --region us-east-1)

# Get private subnets
PRIVATE_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*private*" --query "Subnets[*].SubnetId" --output text --region us-east-1)

# Check tags on public subnets
for subnet in $PUBLIC_SUBNETS; do
  echo "Checking public subnet $subnet"
  aws ec2 describe-subnets --subnet-ids $subnet --query "Subnets[0].Tags[?Key=='kubernetes.io/role/elb']" --output json
done

# Check tags on private subnets
for subnet in $PRIVATE_SUBNETS; do
  echo "Checking private subnet $subnet"
  aws ec2 describe-subnets --subnet-ids $subnet --query "Subnets[0].Tags[?Key=='kubernetes.io/role/internal-elb']" --output json
done
```

### Step 5.2.2: Add Required Tags to Subnets

```bash
# Tag public subnets for external-facing load balancers
for subnet in $PUBLIC_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/elb,Value=1 --region us-east-1
done

# Tag private subnets for internal load balancers
for subnet in $PRIVATE_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/internal-elb,Value=1 --region us-east-1
done

# Tag all subnets with cluster ownership
for subnet in $PUBLIC_SUBNETS $PRIVATE_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/cluster/bootcamp-dev-cluster,Value=shared --region us-east-1
done
```

### Step 5.3: Monitoring Setup with Prometheus and Grafana

The Metrics Server is a cluster-wide aggregator of resource usage data and is required for Horizontal Pod Autoscaler (HPA) to function properly. Without it, HPA cannot collect CPU and memory metrics from pods.

```bash
# Install Metrics Server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Verify Metrics Server deployment
kubectl get deployment metrics-server -n kube-system

# Wait for metrics to be collected (1-2 minutes)
sleep 60

# Verify metrics collection is working
kubectl top nodes
kubectl top pods -n 3-tier-app-eks
```

**Troubleshooting Metrics Server:**
If you're running on a local or non-standard Kubernetes setup, you might need to disable TLS certificate verification:

```bash
# Edit the metrics-server deployment to add the --kubelet-insecure-tls flag
kubectl edit deployment metrics-server -n kube-system

# Add --kubelet-insecure-tls to the args section:
# args:
# - --cert-dir=/tmp
# - --secure-port=4443
# - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
# - --kubelet-use-node-status-port
# - --kubelet-insecure-tls  # Add this line
```

**Common Issues:**
If HPA shows `<unknown>` for metrics with errors like "failed to get cpu utilization: unable to fetch metrics from resource metrics API", it indicates the Metrics Server is not installed or not functioning properly.

### Step 5.4: Deploy Horizontal Pod Autoscaler

**File Location:** `DevOps-Project-36/3-tier-app-eks/k8s/hpa.yaml`

```bash
# Navigate to k8s directory
cd DevOps-Project-36/3-tier-app-eks/k8s

# Deploy HPA for backend and frontend
kubectl apply -f hpa.yaml

# Verify HPA deployment
kubectl get hpa -n 3-tier-app-eks
kubectl describe hpa backend-hpa -n 3-tier-app-eks
kubectl describe hpa frontend-hpa -n 3-tier-app-eks
```

### Step 5.5: Set Up Prometheus and Grafana Monitoring

**File Locations:**
- Setup Script: `DevOps-Project-36/3-tier-app-eks/k8s/monitoring/setup-monitoring.sh`
- Monitoring Ingress: `DevOps-Project-36/3-tier-app-eks/k8s/monitoring/monitoring-ingress.yaml`
- Backend Service Monitor: `DevOps-Project-36/3-tier-app-eks/k8s/monitoring/backend-service-monitor.yaml`

#### Step 5.5.1: Install Prometheus and Grafana
```bash
# Navigate to k8s directory
cd DevOps-Project-36/3-tier-app-eks/k8s

# Make the setup script executable
chmod +x monitoring/setup-monitoring.sh

# Run the setup script
./monitoring/setup-monitoring.sh

# Verify installations
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

#### Step 5.5.2: Configure Service Monitoring
```bash
# Apply the service monitor for backend
kubectl apply -f monitoring/backend-service-monitor.yaml

# Verify service monitor
kubectl get servicemonitor -n monitoring
```

#### Step 5.5.3: Access Monitoring Dashboards Locally
```bash
# Port-forward Prometheus
kubectl port-forward svc/prometheus-server 9090:80 -n monitoring
# Access at: http://localhost:9090

# Port-forward Grafana
kubectl port-forward svc/grafana 3000:80 -n monitoring
# Access at: http://localhost:3000
# Default credentials: admin / EKS!sAw3s0m3
```

#### Step 5.5.4: Remote Access to Monitoring Dashboards

For accessing Prometheus and Grafana from outside the cluster (e.g., from your laptop), you have several options:

#### Option 1: Port Forwarding with SSH Tunnel (Temporary Access)

If you're connecting to a remote server or EC2 instance to manage your cluster:

```bash
# On your laptop, create SSH tunnel to the EC2 instance
ssh -L 9090:localhost:9090 -L 3000:localhost:3000 user@your-ec2-instance-ip

# On the EC2 instance, run the port-forward commands
kubectl port-forward svc/prometheus-server 9090:80 -n monitoring
kubectl port-forward svc/grafana 3000:80 -n monitoring
```

Then access in your browser:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

#### Option 2: Expose via LoadBalancer (Simple Production Access)

```bash
# Update service types to LoadBalancer
kubectl patch svc prometheus-server -n monitoring -p '{"spec": {"type": "LoadBalancer"}}'
kubectl patch svc grafana -n monitoring -p '{"spec": {"type": "LoadBalancer"}}'

# Get the LoadBalancer URLs
kubectl get svc prometheus-server -n monitoring
kubectl get svc grafana -n monitoring
```

Access using the EXTERNAL-IP addresses shown in the output:
- Prometheus: http://<EXTERNAL-IP>
- Grafana: http://<EXTERNAL-IP>

#### Option 3: Ingress Controller (Recommended for Production)

Create an ingress resource for both services:

```bash
# Create basic auth secret for monitoring access
htpasswd -c auth admin
kubectl create secret generic monitoring-basic-auth --from-file=auth -n monitoring

# Create ingress resource
cat > monitoring-ingress.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: monitoring-ingress
  namespace: monitoring
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/auth-type: basic
    alb.ingress.kubernetes.io/auth-secret: monitoring-basic-auth
    alb.ingress.kubernetes.io/auth-realm: "Authentication Required"
spec:
  rules:
  - http:
      paths:
      - path: /prometheus
        pathType: Prefix
        backend:
          service:
            name: prometheus-server
            port:
              number: 80
      - path: /grafana
        pathType: Prefix
        backend:
          service:
            name: grafana
            port:
              number: 80
EOF

# Apply the ingress
kubectl apply -f monitoring-ingress.yaml

# Get the ALB URL
kubectl get ingress monitoring-ingress -n monitoring
```

Access using the ALB address:
- Prometheus: http://<ALB-ADDRESS>/prometheus
- Grafana: http://<ALB-ADDRESS>/grafana

#### Option 4: Custom Domain with AWS Network Load Balancer and ExternalDNS

For a more professional setup with custom domain names:

```bash
# Install ExternalDNS (if not already installed)
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install external-dns bitnami/external-dns \
  --set provider=aws \
  --set aws.zoneType=public \
  --set txtOwnerId=my-cluster-identifier \
  --namespace kube-system

# Create NLB service for Grafana with DNS annotation
cat > grafana-nlb.yaml << EOF
apiVersion: v1
kind: Service
metadata:
  name: grafana-nlb
  namespace: monitoring
  annotations:
    external-dns.alpha.kubernetes.io/hostname: grafana.yourdomain.com
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
    service.beta.kubernetes.io/aws-load-balancer-ssl-cert: arn:aws:acm:region:account-id:certificate/certificate-id
    service.beta.kubernetes.io/aws-load-balancer-ssl-ports: "443"
spec:
  type: LoadBalancer
  ports:
  - port: 443
    targetPort: 3000
    name: https
  selector:
    app.kubernetes.io/name: grafana
EOF

# Apply the NLB service
kubectl apply -f grafana-nlb.yaml

# Create similar service for Prometheus
cat > prometheus-nlb.yaml << EOF
apiVersion: v1
kind: Service
metadata:
  name: prometheus-nlb
  namespace: monitoring
  annotations:
    external-dns.alpha.kubernetes.io/hostname: prometheus.yourdomain.com
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
    service.beta.kubernetes.io/aws-load-balancer-ssl-cert: arn:aws:acm:region:account-id:certificate/certificate-id
    service.beta.kubernetes.io/aws-load-balancer-ssl-ports: "443"
spec:
  type: LoadBalancer
  ports:
  - port: 443
    targetPort: 9090
    name: https
  selector:
    app: prometheus
    component: server
EOF

kubectl apply -f prometheus-nlb.yaml
```

Access using your custom domains:
- Prometheus: https://prometheus.yourdomain.com
- Grafana: https://grafana.yourdomain.com

#### Step 5.5.5: Security Hardening for Monitoring Access

For production environments, implement these additional security measures:

#### 1. Configure Grafana Authentication

```bash
# Update Grafana with OAuth or LDAP authentication
kubectl edit configmap -n monitoring grafana

# Add the following to grafana.ini section:
# [auth.google]
# enabled = true
# client_id = YOUR_GOOGLE_CLIENT_ID
# client_secret = YOUR_GOOGLE_CLIENT_SECRET
# scopes = https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email
# auth_url = https://accounts.google.com/o/oauth2/auth
# token_url = https://accounts.google.com/o/oauth2/token
# allowed_domains = yourdomain.com
# allow_sign_up = true

# Restart Grafana pod to apply changes
kubectl rollout restart deployment grafana -n monitoring
```

#### 2. Implement Network Policies

```bash
# Create network policy to restrict access to monitoring namespace
cat > monitoring-network-policy.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-access
  namespace: monitoring
spec:
  podSelector: {}
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    - namespaceSelector:
        matchLabels:
          name: 3-tier-app-eks
    - ipBlock:
        cidr: 10.0.0.0/8  # VPC CIDR or trusted IP range
  policyTypes:
  - Ingress
EOF

kubectl apply -f monitoring-network-policy.yaml
```

#### 3. Configure Prometheus RBAC

```bash
# Create dedicated service account with restricted permissions
cat > prometheus-rbac.yaml << EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus-restricted
  namespace: monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus-restricted
rules:
- apiGroups: [""]
  resources: ["nodes", "nodes/proxy", "services", "endpoints", "pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["extensions"]
  resources: ["ingresses"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prometheus-restricted
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: prometheus-restricted
subjects:
- kind: ServiceAccount
  name: prometheus-restricted
  namespace: monitoring
EOF

kubectl apply -f prometheus-rbac.yaml
```

#### 4. Enable Audit Logging

```bash
# Update Prometheus and Grafana to enable audit logging
kubectl edit deployment prometheus-server -n monitoring
# Add environment variable:
# - name: PROMETHEUS_ENABLE_AUDIT_LOG
#   value: "true"

kubectl edit deployment grafana -n monitoring
# Add to grafana.ini:
# [log]
# level = info
# mode = console file
# [log.file]
# level = info
# format = text
```

### Step 5.5.6: Configuring Prometheus and Grafana Dashboards

After setting up access to Prometheus and Grafana, follow these steps to configure useful dashboards for monitoring your 3-tier application.

#### Step 5.5.6.1: Verify Prometheus Data Collection

```bash
# Ensure Prometheus is accessible
kubectl port-forward svc/prometheus-server 9090:80 -n monitoring
```

1. Open Prometheus in your browser: http://localhost:9090
2. Verify targets are being scraped:
   - Navigate to Status > Targets
   - Confirm that the backend service monitor shows "State: UP"
   - If targets show "DOWN", check your ServiceMonitor configuration

3. Test basic queries:
   - In the Graph tab, enter: `up` and click Execute
   - All monitored services should show value 1
   - Try other queries like `container_cpu_usage_seconds_total` to verify metrics collection

#### Step 5.5.6.2: Import Pre-built Kubernetes Dashboards in Grafana

```bash
# Ensure Grafana is accessible
kubectl port-forward svc/grafana 3000:80 -n monitoring
```

1. Open Grafana in your browser: http://localhost:3000
2. Log in with default credentials:
   - Username: admin
   - Password: EKS!sAw3s0m3

3. Import Kubernetes cluster dashboard:
   - Click on "+" icon in the left sidebar
   - Select "Import"
   - Enter dashboard ID: 10856 (Kubernetes Cluster Dashboard)
   - Click "Load"
   - Select "Prometheus" as the data source
   - Click "Import"

4. Import Kubernetes pod monitoring dashboard:
   - Repeat the import process
   - Use dashboard ID: 6417 (Kubernetes Pod Monitoring)
   - Select "Prometheus" as the data source

#### Step 5.5.6.3: Create Custom Dashboard for 3-Tier Application

1. Create a new dashboard:
   - Click on "+" icon in the left sidebar
   - Select "Dashboard"
   - Click "Add new panel"

2. Add CPU usage panel:
   - In the query field, enter: 
     ```
     rate(container_cpu_usage_seconds_total{namespace="3-tier-app-eks", container=~"backend|frontend"}[5m])
     ```
   - Set panel title: "CPU Usage by Container"
   - Under Visualization, select "Time series"
   - Click "Apply"

3. Add memory usage panel:
   - Click "Add panel"
   - Enter query: 
     ```
     container_memory_usage_bytes{namespace="3-tier-app-eks", container=~"backend|frontend"} / 1024 / 1024
     ```
   - Set panel title: "Memory Usage (MB)"
   - Under Visualization, select "Time series"
   - Click "Apply"

4. Add request count panel:
   - Click "Add panel"
   - Enter query: 
     ```
     sum(rate(http_requests_total{namespace="3-tier-app-eks"}[5m])) by (service)
     ```
   - Set panel title: "HTTP Request Rate"
   - Click "Apply"

5. Add response time panel:
   - Click "Add panel"
   - Enter query: 
     ```
     histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="3-tier-app-eks"}[5m])) by (le, service))
     ```
   - Set panel title: "95th Percentile Response Time"
   - Click "Apply"

6. Add HPA status panel:
   - Click "Add panel"
   - Enter query: 
     ```
     kube_horizontalpodautoscaler_status_current_replicas{namespace="3-tier-app-eks"}
     ```
   - Set panel title: "Current Replica Count"
   - Click "Apply"

7. Save the dashboard:
   - Click the save icon (disk) in the top right
   - Name it "3-Tier Application Dashboard"
   - Click "Save"

#### Step 5.5.6.4: Set Up Alerting (Optional)

1. Create a CPU usage alert:
   - Navigate to Alerting > Alert Rules
   - Click "New alert rule"
   - Enter query: 
     ```
     max(rate(container_cpu_usage_seconds_total{namespace="3-tier-app-eks"}[5m])) by (pod) > 0.8
     ```
   - Set condition: "IS ABOVE 0.8"
   - Set evaluation interval: 1m
   - Set rule name: "High CPU Usage"
   - Set message: "Pod {{ $labels.pod }} in 3-tier-app-eks namespace has high CPU usage"
   - Click "Save"

2. Create a memory usage alert:
   - Click "New alert rule"
   - Enter query: 
     ```
     max(container_memory_usage_bytes{namespace="3-tier-app-eks"} / container_spec_memory_limit_bytes{namespace="3-tier-app-eks"} * 100) by (pod) > 85
     ```
   - Set condition: "IS ABOVE 85"
   - Set rule name: "High Memory Usage"
   - Set message: "Pod {{ $labels.pod }} in 3-tier-app-eks namespace is using more than 85% of its memory limit"
   - Click "Save"

#### Step 5.5.6.5: Create Dashboard for Database Monitoring

1. Create a new dashboard:
   - Click on "+" icon in the left sidebar
   - Select "Dashboard"
   - Click "Add new panel"

2. Add database connections panel:
   - In the query field, enter: 
     ```
     pg_stat_activity_count{namespace="3-tier-app-eks"}
     ```
   - Set panel title: "PostgreSQL Active Connections"
   - Click "Apply"

3. Add database transaction rate panel:
   - Click "Add panel"
   - Enter query: 
     ```
     rate(pg_stat_database_xact_commit{namespace="3-tier-app-eks"}[5m]) + rate(pg_stat_database_xact_rollback{namespace="3-tier-app-eks"}[5m])
     ```
   - Set panel title: "Transaction Rate"
   - Click "Apply"

4. Add database cache hit ratio panel:
   - Click "Add panel"
   - Enter query: 
     ```
     pg_stat_database_blks_hit{namespace="3-tier-app-eks"} / (pg_stat_database_blks_hit{namespace="3-tier-app-eks"} + pg_stat_database_blks_read{namespace="3-tier-app-eks"}) * 100
     ```
   - Set panel title: "Cache Hit Ratio (%)"
   - Click "Apply"

5. Save the dashboard:
   - Click the save icon in the top right
   - Name it "Database Monitoring Dashboard"
   - Click "Save"

#### Step 5.5.6.6: Configure Dashboard Refresh and Time Range

1. Set automatic refresh:
   - In the dashboard view, click on the refresh icon in the top right
   - Select an appropriate refresh interval (e.g., 30s or 1m)

2. Set default time range:
   - Click on the time range selector in the top right
   - Select an appropriate range (e.g., Last 3 hours)
   - Click "Apply"

3. Make dashboard default:
   - Click the star icon next to the dashboard name to favorite it
   - Go to Grafana Configuration > Preferences
   - Set your 3-Tier Application Dashboard as Home Dashboard

#### Step 5.5.6.7: Troubleshooting Dashboard Issues

If metrics aren't showing up in your dashboards:

1. Check ServiceMonitor configuration:
   ```bash
   kubectl get servicemonitor -n monitoring
   kubectl describe servicemonitor backend-monitor -n monitoring
   ```

2. Verify that your application is exposing metrics:
   ```bash
   # Port-forward to your backend service
   kubectl port-forward svc/backend 8000:8000 -n 3-tier-app-eks
   
   # Check metrics endpoint
   curl http://localhost:8000/metrics
   ```

3. Check Prometheus targets and logs:
   ```bash
   # Check Prometheus logs
   kubectl logs -n monitoring -l app=prometheus,component=server
   ```

4. Verify that the metrics port is correctly specified in your ServiceMonitor and matches your application's metrics port.

### Step 5.6: Configure Resource Monitoring
```bash
# Monitor resource usage
watch kubectl get pods -n 3-tier-app-eks -o wide

# Check HPA status
watch kubectl get hpa -n 3-tier-app-eks
```

---

## Phase 6: CI/CD Integration

### Step 6.1: GitHub Actions OIDC Setup

**File Location:** `DevOps-Project-36/3-tier-app-eks/.github/workflows/deploy.yml`

#### Step 6.1.1: Configure OIDC Provider for GitHub Actions
```bash
# Navigate to OIDC configuration
cd DevOps-Project-36/infra/aws-oidc-github-cli/

# Review OIDC configuration
cat configure-oidc-github.sh

# Make the script executable
chmod +x configure-oidc-github.sh

# Run the script (if not already done by Terraform)
./configure-oidc-github.sh
```

#### Step 6.1.2: Set Up GitHub Repository Secrets

Configure the following secrets in your GitHub repository:

- `AWS_REGION`: The AWS region (e.g., us-east-1)
- `EKS_CLUSTER_NAME`: The name of your EKS cluster (e.g., bootcamp-dev-cluster)
- `KUBE_NAMESPACE`: The Kubernetes namespace (e.g., 3-tier-app-eks)
- `OIDC_ROLE_ARN`: The ARN of the IAM role for GitHub Actions
- `ECR_BACKEND_REPO`: The ECR repository URL for the backend image
- `ECR_FRONTEND_REPO`: The ECR repository URL for the frontend image

#### Step 6.1.3: Configure GitHub Actions Workflow

The workflow file is already created at `.github/workflows/deploy.yml`. It includes:

- Building and testing the application
- Building and pushing Docker images to ECR
- Deploying to EKS
- Smoke testing
- Automatic rollback on failure

```bash
# Navigate to the GitHub Actions workflow directory
cd DevOps-Project-36/3-tier-app-eks/.github/workflows/

# Review the workflow file
cat deploy.yml
```

#### Step 6.1.4: Trigger CI/CD Pipeline

The pipeline will be triggered automatically on:
- Push to the main branch
- Pull request to the main branch
- Manual trigger via GitHub Actions UI

To manually trigger the workflow:
1. Go to your GitHub repository
2. Click on "Actions"
3. Select the "CI/CD Pipeline" workflow
4. Click "Run workflow"

---

## Phase 7: Validation and Testing

### Step 7.1: Comprehensive Deployment Validation

**File Location:** `DevOps-Project-36/3-tier-app-eks/k8s/validate-deployment.sh`

```bash
# Navigate to k8s directory
cd DevOps-Project-36/3-tier-app-eks/k8s

# Make the validation script executable
chmod +x validate-deployment.sh

# Run the validation script
./validate-deployment.sh
```

The validation script checks:
- Namespace existence
- Deployment status
- Service availability
- Ingress configuration
- ALB endpoint accessibility
- API functionality
- HPA configuration
- Monitoring setup

### Step 7.2: Monitoring and Logs Review
```bash
# Check application logs
echo "=== Backend Logs ==="
kubectl logs -n 3-tier-app-eks -l app=backend --tail=20

echo "=== Frontend Logs ==="
kubectl logs -n 3-tier-app-eks -l app=frontend --tail=20

# Check ALB controller logs
echo "=== ALB Controller Logs ==="
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=10

# Check for ALB controller errors
kubectl logs -n kube-system deployment/aws-load-balancer-controller | grep -i error || echo "No errors found in ALB controller logs"

# Monitor resource usage
kubectl top pods -n 3-tier-app-eks
kubectl top nodes

# Check pod events for issues
kubectl get events -n 3-tier-app-eks --sort-by='.lastTimestamp' --field-selector type=Warning

# Stream logs in real-time (for debugging)
echo "=== Real-time Log Monitoring Commands ==="
echo "Backend logs: kubectl logs -n 3-tier-app-eks -l app=backend -f"
echo "Frontend logs: kubectl logs -n 3-tier-app-eks -l app=frontend -f"
echo "ALB controller logs: kubectl logs -n kube-system deployment/aws-load-balancer-controller -f"
```

### Step 7.3: Security and Connectivity Testing
```bash
# Test database connectivity from within cluster
kubectl run db-test --rm -it --image=postgres:13 -n 3-tier-app-eks -- bash
# Inside the pod, run:
# PGPASSWORD=YourStrongPassword123! psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U postgresadmin -d postgres -c "\dt"
# exit

# Test internal service connectivity
kubectl run connectivity-test --rm -it --image=busybox -n 3-tier-app-eks -- sh
# Inside the pod, run:
# nslookup backend.3-tier-app-eks.svc.cluster.local
# nslookup frontend.3-tier-app-eks.svc.cluster.local
# wget -qO- http://backend.3-tier-app-eks.svc.cluster.local:8000/api/topics
# exit
```

---

## Phase 8: Cleanup

### Step 8.1: Kubernetes Resources Cleanup
```bash
# Navigate to k8s directory
cd k8s/

# Delete all Kubernetes resources in reverse order
kubectl delete -f ingress.yaml
kubectl delete -f frontend.yaml
kubectl delete -f backend.yaml
kubectl delete -f migration_job.yaml
kubectl delete -f database-service.yaml
kubectl delete -f hpa.yaml
kubectl delete -f configmap.yaml
kubectl delete -f secrets.yaml
kubectl delete -f namespace.yaml

# Uninstall ALB controller
helm uninstall aws-load-balancer-controller -n kube-system

# Delete ALB IAM policy
aws iam delete-policy --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy
```

### Step 8.2: Infrastructure Cleanup with Terraform
```bash
# Navigate to infrastructure directory
cd ../infra/

# Destroy all infrastructure (takes 10-15 minutes)
terraform destroy -auto-approve

# Verify cleanup
aws eks list-clusters --region us-east-1
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier,`bootcamp-dev-db`)]'
```

### Step 8.3: Manual Cleanup Verification
```bash
# Check for any remaining resources
echo "=== Checking for remaining resources ==="

# Check EKS clusters
aws eks list-clusters --region us-east-1

# Check RDS instances
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[].DBInstanceIdentifier'

# Check VPCs (should only show default VPC)
aws ec2 describe-vpcs --region us-east-1 --query 'Vpcs[].{VpcId:VpcId,IsDefault:IsDefault,State:State}'

# Check Load Balancers
aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[].LoadBalancerName'

echo "=== Cleanup verification complete ==="
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: EKS Node Group Creation Failed
```bash
# Check node group status
aws eks describe-nodegroup --cluster-name bootcamp-dev-cluster --nodegroup-name <nodegroup-name> --region us-east-1

# Check EKS add-ons
aws eks list-addons --cluster-name bootcamp-dev-cluster --region us-east-1

# Solution: Ensure VPC CNI add-on is installed before node groups
```

#### Issue 1.5: Subnet Tagging Issues (ALB Creation Failed)
```bash
# Check if subnets are properly tagged for ALB
VPC_ID=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)

# Check public subnet tags
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=true" --query "Subnets[*].{SubnetId:SubnetId,Tags:Tags[?Key=='kubernetes.io/role/elb']}" --region us-east-1

# Fix missing tags
PUBLIC_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=true" --query "Subnets[*].SubnetId" --output text --region us-east-1)

for subnet in $PUBLIC_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/elb,Value=1 --region us-east-1
done
```

#### Issue 2: Pods Stuck in Pending State
```bash
# Check pod events
kubectl describe pod <pod-name> -n 3-tier-app-eks

# Check node resources
kubectl top nodes
kubectl describe nodes

# Common solutions:
# - Insufficient node capacity
# - Missing node selectors
# - Resource constraints
```

#### Issue 3: ALB Not Creating
```bash
# Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=50

# Check ingress events
kubectl describe ingress 3-tier-app-ingress -n 3-tier-app-eks

# Check ingress status
kubectl get ingress -n 3-tier-app-eks -o wide

# Verify subnet tags
VPC_ID=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].{SubnetId:SubnetId,Tags:Tags}' --region us-east-1

# Force delete stuck ingress
kubectl patch ingress 3-tier-app-ingress -n 3-tier-app-eks -p '{"metadata":{"finalizers":[]}}' --type=merge
kubectl delete ingress 3-tier-app-ingress -n 3-tier-app-eks --grace-period=0 --force

# Recreate ingress
kubectl apply -f ingress.yaml
```

#### Issue 4: Database Connection Failed
```bash
# Check database service
kubectl get svc postgres-db -n 3-tier-app-eks
kubectl describe svc postgres-db -n 3-tier-app-eks

# Check RDS security groups
aws rds describe-db-instances --db-instance-identifier bootcamp-dev-db --query 'DBInstances[0].VpcSecurityGroups'

# Test connectivity
kubectl run db-test --rm -it --image=postgres:13 -n 3-tier-app-eks -- bash
```

#### Issue 5: Application Not Accessible
```bash
# Check ingress status
kubectl get ingress -n 3-tier-app-eks
kubectl describe ingress 3-tier-app-ingress -n 3-tier-app-eks

# Check ALB target groups
aws elbv2 describe-target-groups --region us-east-1

# Check application logs
kubectl logs -n 3-tier-app-eks -l app=backend
kubectl logs -n 3-tier-app-eks -l app=frontend
```

### Debug Commands Reference
```bash
# General debugging
kubectl get events -n 3-tier-app-eks --sort-by='.lastTimestamp'
kubectl get all -n 3-tier-app-eks
kubectl describe pod <pod-name> -n 3-tier-app-eks

# Network debugging
kubectl run netshoot --rm -it --image=nicolaka/netshoot -n 3-tier-app-eks -- bash

# Resource monitoring
kubectl top pods -n 3-tier-app-eks
kubectl top nodes
```

---

## Summary

### Deployment Summary

This comprehensive guide covers the complete deployment of a 3-tier application on AWS EKS, including:

#### ✅ **Successfully Deployed Components:**
- **Infrastructure**: EKS cluster, RDS PostgreSQL, VPC networking in us-east-1
- **Kubernetes**: Namespace, secrets, configmaps, services, deployments
- **Load Balancing**: AWS ALB with ingress controller
- **Monitoring**: HPA for auto-scaling
- **CI/CD**: GitHub Actions with OIDC integration

#### 📋 **Deployment Phases Summary:**

| Phase | Component | Duration | Key Actions |
|-------|-----------|----------|-------------|
| 1 | Infrastructure | 15-20 min | Terraform apply, EKS cluster creation |
| 2 | Kubernetes Setup | 5-10 min | kubectl config, ALB controller install |
| 2.5 | Security Config | 3-5 min | Security groups, OIDC, IAM verification |
| 3 | Application Deploy | 10-15 min | Manifest deployment in correct order |
| 4 | Ingress & ALB | 5-10 min | ALB creation and configuration |
| 4.5 | DNS Setup | 5-10 min | Custom domain and SSL (optional) |
| 5 | Monitoring | 2-5 min | HPA and metrics setup |
| 6 | CI/CD | 5-10 min | GitHub Actions configuration |
| 7 | Testing | 10-15 min | Comprehensive validation and debugging |
| 8 | Cleanup | 10-15 min | Resource cleanup and verification |

#### 🎯 **Critical Success Factors:**
1. **Correct Manifest Order**: Namespace → Secrets → Services → Applications → Ingress
2. **Subnet Tagging**: CRITICAL - Public subnets must be tagged with `kubernetes.io/role/elb=1`
3. **ALB Controller**: Must be installed after subnet tagging and before ingress deployment
4. **Database Migration**: Must complete before application deployment
5. **Security Groups**: Proper configuration for RDS access (handled by Terraform)
6. **Database Connectivity**: Test DNS resolution and database connection before app deployment
7. **OIDC Provider**: Required for ALB controller service account authentication

#### 🔧 **Key Commands Reference:**

```bash
# Infrastructure
terraform apply -auto-approve

# Kubernetes Setup
aws eks update-kubeconfig --region us-east-1 --name bootcamp-dev-cluster

# Application Deployment (in order)
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
kubectl apply -f database-service.yaml
kubectl apply -f migration_job.yaml
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml

# Validation
kubectl get all -n 3-tier-app-eks
kubectl get ingress -n 3-tier-app-eks

# Cleanup
terraform destroy -auto-approve
```

#### 📊 **Expected Results:**
- **Frontend**: Accessible via ALB DNS name
- **Backend API**: Available at `/api` endpoint
- **Database**: PostgreSQL accessible from cluster
- **Auto-scaling**: HPA configured for traffic spikes
- **Monitoring**: Resource usage tracking enabled

#### 🚀 **Next Steps:**
- Configure custom domain with Route53
- Set up SSL/TLS certificates
- Implement comprehensive monitoring with Prometheus/Grafana
- Configure backup strategies for RDS
- Set up multi-environment deployments (dev/staging/prod)

---

## Phase 9: Advanced Configuration

### Step 9.1: Configure Custom Domain with Route53

#### Step 9.1.1: Create Route53 Hosted Zone
```bash
# Create a hosted zone for your domain
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s) \
  --hosted-zone-config Comment="Public hosted zone for yourdomain.com"

# Get the hosted zone ID
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name yourdomain.com --query "HostedZones[0].Id" --output text | sed 's/\/hostedzone\///')
echo "Hosted Zone ID: $ZONE_ID"
```

#### Step 9.1.2: Update Domain Nameservers
After creating the hosted zone, you'll need to update your domain's nameservers at your domain registrar (GoDaddy, Namecheap, etc.) with the nameservers provided by Route53.

```bash
# Get the nameservers for your hosted zone
aws route53 get-hosted-zone --id $ZONE_ID --query "DelegationSet.NameServers"
```

#### Step 9.1.3: Create Alias Record for ALB
```bash
# Get the ALB DNS name from the Ingress
ALB_DNS=$(kubectl get ingress 3-tier-app-ingress -n 3-tier-app-eks -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "ALB DNS Name: $ALB_DNS"

# Create an A record alias pointing to the ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [
      {
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "app.yourdomain.com",
          "Type": "A",
          "AliasTarget": {
            "HostedZoneId": "Z32O12XQLNTSW2",
            "DNSName": "'$ALB_DNS'",
            "EvaluateTargetHealth": true
          }
        }
      }
    ]
  }'
```

#### Step 9.1.4: Verify DNS Resolution
```bash
# Wait for DNS propagation (can take up to 48 hours, but usually much faster)
# Test DNS resolution
dig app.yourdomain.com

# Test application access
curl -I http://app.yourdomain.com
```

### Step 9.2: Set Up SSL/TLS Certificates with cert-manager

#### Step 9.2.1: Install cert-manager
```bash
# Add the Jetstack Helm repository
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install cert-manager with CRDs
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.13.3 \
  --set installCRDs=true

# Verify installation
kubectl get pods -n cert-manager
```

#### Step 9.2.2: Create IAM Policy for Route53 Access
```bash
# Create IAM policy for cert-manager to access Route53
cat > route53-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "route53:GetChange",
      "Resource": "arn:aws:route53:::change/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets"
      ],
      "Resource": "arn:aws:route53:::hostedzone/$ZONE_ID"
    },
    {
      "Effect": "Allow",
      "Action": "route53:ListHostedZonesByName",
      "Resource": "*"
    }
  ]
}
EOF

# Create the policy
aws iam create-policy \
  --policy-name cert-manager-route53 \
  --policy-document file://route53-policy.json
```

#### Step 9.2.3: Create IAM Role for cert-manager
```bash
# Create IAM role for cert-manager
eksctl create iamserviceaccount \
  --cluster=bootcamp-dev-cluster \
  --namespace=cert-manager \
  --name=cert-manager \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/cert-manager-route53 \
  --approve
```

#### Step 9.2.4: Create ClusterIssuer for Let's Encrypt
```bash
# Create ClusterIssuer for Let's Encrypt
cat > cluster-issuer.yaml << EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - selector:
        dnsZones:
          - "yourdomain.com"
      dns01:
        route53:
          region: us-east-1
          hostedZoneID: $ZONE_ID
EOF

# Apply the ClusterIssuer
kubectl apply -f cluster-issuer.yaml

# Verify ClusterIssuer
kubectl get clusterissuer letsencrypt-prod -o wide
```

#### Step 9.2.5: Create Certificate Resource
```bash
# Create Certificate resource
cat > certificate.yaml << EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: yourdomain-com-tls
  namespace: 3-tier-app-eks
spec:
  secretName: yourdomain-com-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - app.yourdomain.com
EOF

# Apply the Certificate
kubectl apply -f certificate.yaml

# Monitor certificate issuance
kubectl get certificate -n 3-tier-app-eks
kubectl describe certificate yourdomain-com-tls -n 3-tier-app-eks
```

#### Step 9.2.6: Update Ingress to Use TLS
```bash
# Update ingress to use TLS
cat > ingress-with-tls.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: 3-tier-app-ingress
  namespace: 3-tier-app-eks
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/actions.ssl-redirect: '{"Type": "redirect", "RedirectConfig": {"Protocol": "HTTPS", "Port": "443", "StatusCode": "HTTP_301"}}'
spec:
  ingressClassName: alb
  tls:
  - hosts:
    - app.yourdomain.com
    secretName: yourdomain-com-tls
  rules:
  - host: app.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
EOF

# Apply the updated ingress
kubectl apply -f ingress-with-tls.yaml

# Verify ingress
kubectl get ingress -n 3-tier-app-eks
```

#### Step 9.2.7: Test HTTPS Access
```bash
# Test HTTPS access
curl -I https://app.yourdomain.com
```

### Step 9.3: Implement Comprehensive Monitoring with Prometheus/Grafana

#### Step 9.3.1: Install Prometheus Operator using Helm
```bash
# Create monitoring namespace
kubectl create namespace monitoring

# Add Prometheus Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus Operator
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.adminPassword=admin \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false
```

#### Step 9.3.2: Create ServiceMonitor for Backend Application
```bash
# Create ServiceMonitor for backend
cat > backend-service-monitor.yaml << EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backend-monitor
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: backend
  namespaceSelector:
    matchNames:
      - 3-tier-app-eks
  endpoints:
  - port: http
    path: /metrics
    interval: 15s
EOF

# Apply ServiceMonitor
kubectl apply -f backend-service-monitor.yaml
```

#### Step 9.3.3: Access Grafana Dashboard
```bash
# Port-forward Grafana service
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring

# Access Grafana at http://localhost:3000
# Default credentials: admin / admin
```

#### Step 9.3.4: Import Kubernetes Dashboard
In Grafana UI:
1. Go to "+" > "Import"
2. Enter dashboard ID: 10856 (Kubernetes Cluster Dashboard)
3. Select Prometheus data source
4. Click "Import"

#### Step 9.3.5: Create Custom Dashboard for Application
In Grafana UI:
1. Go to "+" > "Dashboard" > "Add new panel"
2. Configure metrics for your application
3. Save the dashboard

### Step 9.4: Configure Backup Strategies for RDS

#### Step 9.4.1: Configure Automated Snapshots
```bash
# Enable automated backups with 7-day retention
aws rds modify-db-instance \
  --db-instance-identifier bootcamp-dev-db \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --apply-immediately

# Verify backup settings
aws rds describe-db-instances \
  --db-instance-identifier bootcamp-dev-db \
  --query "DBInstances[0].BackupRetentionPeriod"
```

#### Step 9.4.2: Create Manual Snapshot
```bash
# Create a manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier bootcamp-dev-db \
  --db-snapshot-identifier bootcamp-dev-manual-snapshot-$(date +%Y%m%d)

# Monitor snapshot creation
aws rds describe-db-snapshots \
  --db-snapshot-identifier bootcamp-dev-manual-snapshot-$(date +%Y%m%d) \
  --query "DBSnapshots[0].Status"
```

#### Step 9.4.3: Set Up Snapshot Export to S3
```bash
# Create S3 bucket for exports
aws s3 mb s3://bootcamp-dev-db-backups-$(aws sts get-caller-identity --query Account --output text)

# Create IAM role for RDS export
aws iam create-role \
  --role-name rds-s3-export-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "export.rds.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }'

# Attach policy to role
aws iam attach-role-policy \
  --role-name rds-s3-export-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Start export task (requires PostgreSQL 10.13 or higher)
aws rds start-export-task \
  --export-task-identifier bootcamp-dev-export-$(date +%Y%m%d) \
  --source-arn arn:aws:rds:us-east-1:$(aws sts get-caller-identity --query Account --output text):snapshot:bootcamp-dev-manual-snapshot-$(date +%Y%m%d) \
  --s3-bucket-name bootcamp-dev-db-backups-$(aws sts get-caller-identity --query Account --output text) \
  --iam-role-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/rds-s3-export-role \
  --kms-key-id alias/aws/rds
```

### Step 9.5: Set Up Multi-Environment Deployments

#### Step 9.5.1: Create Environment-Specific Terraform Variables
```bash
# Create staging environment variables
cat > terraform.tfvars.staging << EOF
aws_region   = "us-east-1"
environment  = "staging"
project_name = "DevOpsDojo"
vpc_cidr     = "10.1.0.0/16"
instance_type = "t3.medium"
EOF

# Create production environment variables
cat > terraform.tfvars.prod << EOF
aws_region   = "us-east-1"
environment  = "prod"
project_name = "DevOpsDojo"
vpc_cidr     = "10.2.0.0/16"
instance_type = "t3.large"
EOF
```

#### Step 9.5.2: Create Environment-Specific Kubernetes Manifests
```bash
# Create directory structure
mkdir -p k8s/overlays/{dev,staging,prod}
mkdir -p k8s/base

# Move existing manifests to base directory
cp *.yaml k8s/base/

# Create kustomization.yaml for base
cat > k8s/base/kustomization.yaml << EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- namespace.yaml
- configmap.yaml
- secrets.yaml
- database-service.yaml
- backend.yaml
- frontend.yaml
- ingress.yaml
- hpa.yaml
EOF

# Create dev overlay
cat > k8s/overlays/dev/kustomization.yaml << EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
bases:
- ../../base
namespace: 3-tier-app-eks-dev
patchesStrategicMerge:
- replicas.yaml
EOF

cat > k8s/overlays/dev/replicas.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 2
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 2
EOF

# Create staging overlay
cat > k8s/overlays/staging/kustomization.yaml << EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
bases:
- ../../base
namespace: 3-tier-app-eks-staging
patchesStrategicMerge:
- replicas.yaml
EOF

cat > k8s/overlays/staging/replicas.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 3
EOF

# Create production overlay
cat > k8s/overlays/prod/kustomization.yaml << EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
bases:
- ../../base
namespace: 3-tier-app-eks-prod
patchesStrategicMerge:
- replicas.yaml
- resources.yaml
EOF

cat > k8s/overlays/prod/replicas.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 5
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 5
EOF

cat > k8s/overlays/prod/resources.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  template:
    spec:
      containers:
      - name: backend
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  template:
    spec:
      containers:
      - name: frontend
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
EOF
```

#### Step 9.5.3: Create GitHub Actions Workflow for Multi-Environment Deployment
```bash
# Create GitHub Actions workflow
mkdir -p .github/workflows

cat > .github/workflows/multi-env-deploy.yml << EOF
name: Multi-Environment Deployment

on:
  push:
    branches:
      - main
      - staging
      - dev
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'dev'
        type: choice
        options:
          - dev
          - staging
          - prod

jobs:
  determine-environment:
    runs-on: ubuntu-latest
    outputs:
      environment: \${{ steps.set-env.outputs.environment }}
    steps:
      - id: set-env
        run: |
          if [ "\${{ github.event_name }}" == "workflow_dispatch" ]; then
            echo "environment=\${{ github.event.inputs.environment }}" >> \$GITHUB_OUTPUT
          elif [ "\${{ github.ref }}" == "refs/heads/main" ]; then
            echo "environment=prod" >> \$GITHUB_OUTPUT
          elif [ "\${{ github.ref }}" == "refs/heads/staging" ]; then
            echo "environment=staging" >> \$GITHUB_OUTPUT
          else
            echo "environment=dev" >> \$GITHUB_OUTPUT
          fi

  deploy:
    needs: determine-environment
    runs-on: ubuntu-latest
    environment: \${{ needs.determine-environment.outputs.environment }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: arn:aws:iam::\${{ secrets.AWS_ACCOUNT_ID }}:role/github-actions-role
          aws-region: us-east-1

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region us-east-1 --name bootcamp-\${{ needs.determine-environment.outputs.environment }}-cluster

      - name: Deploy with Kustomize
        run: |
          kubectl apply -k k8s/overlays/\${{ needs.determine-environment.outputs.environment }}
          
      - name: Verify deployment
        run: |
          kubectl get all -n 3-tier-app-eks-\${{ needs.determine-environment.outputs.environment }}
EOF
```

#### Step 9.5.4: Deploy to Different Environments
```bash
# Deploy to dev environment
kubectl apply -k k8s/overlays/dev

# Deploy to staging environment
kubectl apply -k k8s/overlays/staging

# Deploy to production environment
kubectl apply -k k8s/overlays/prod
```

---

## Phase 10: Maintenance and Operations

### Step 10.1: Regular Maintenance Tasks

#### Step 10.1.1: Update Kubernetes Resources
```bash
# Update EKS cluster version
aws eks update-cluster-version \
  --name bootcamp-dev-cluster \
  --kubernetes-version 1.28

# Update node groups
aws eks update-nodegroup-version \
  --cluster-name bootcamp-dev-cluster \
  --nodegroup-name bootcamp-dev-nodes
```

#### Step 10.1.2: Database Maintenance
```bash
# Perform database maintenance
aws rds modify-db-instance \
  --db-instance-identifier bootcamp-dev-db \
  --apply-immediately \
  --preferred-maintenance-window "Sun:05:00-Sun:06:00"
```

#### Step 10.1.3: Rotate Secrets
```bash
# Generate new secrets
kubectl create secret generic db-secrets \
  --namespace 3-tier-app-eks \
  --from-literal=DB_USER=postgres \
  --from-literal=DB_PASSWORD=$(openssl rand -base64 20) \
  --from-literal=DB_HOST=postgres-db.3-tier-app-eks.svc.cluster.local \
  --from-literal=DB_NAME=devopsdojo \
  --from-literal=DATABASE_URL="postgresql://postgres:$(openssl rand -base64 20)@postgres-db.3-tier-app-eks.svc.cluster.local:5432/devopsdojo" \
  --from-literal=SECRET_KEY=$(openssl rand -base64 32) \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart deployments to pick up new secrets
kubectl rollout restart deployment/backend -n 3-tier-app-eks
kubectl rollout restart deployment/frontend -n 3-tier-app-eks
```

### Step 10.2: Disaster Recovery Procedures

#### Step 10.2.1: Restore Database from Snapshot
```bash
# List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier bootcamp-dev-db \
  --query "DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]" \
  --output table

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier bootcamp-dev-db-restored \
  --db-snapshot-identifier bootcamp-dev-manual-snapshot-20250707 \
  --db-instance-class db.t3.medium \
  --no-publicly-accessible
```

#### Step 10.2.2: Backup Kubernetes Resources
```bash
# Backup all resources in the namespace
mkdir -p k8s-backups/$(date +%Y%m%d)
kubectl get all -n 3-tier-app-eks -o yaml > k8s-backups/$(date +%Y%m%d)/all-resources.yaml
kubectl get configmap -n 3-tier-app-eks -o yaml > k8s-backups/$(date +%Y%m%d)/configmaps.yaml
kubectl get secret -n 3-tier-app-eks -o yaml > k8s-backups/$(date +%Y%m%d)/secrets.yaml
kubectl get ingress -n 3-tier-app-eks -o yaml > k8s-backups/$(date +%Y%m%d)/ingress.yaml
```

#### Step 10.2.3: Restore from Backup
```bash
# Restore from backup
kubectl apply -f k8s-backups/20250707/all-resources.yaml
kubectl apply -f k8s-backups/20250707/configmaps.yaml
kubectl apply -f k8s-backups/20250707/secrets.yaml
kubectl apply -f k8s-backups/20250707/ingress.yaml
```

### Step 10.3: Performance Optimization

#### Step 10.3.1: Analyze Resource Usage
```bash
# Check resource usage
kubectl top pods -n 3-tier-app-eks
kubectl top nodes

# Get detailed metrics from Prometheus
# (Access Prometheus UI or use API)
```

#### Step 10.3.2: Optimize Resource Requests and Limits
```bash
# Update deployment with optimized resources
cat > optimized-resources.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: 3-tier-app-eks
spec:
  template:
    spec:
      containers:
      - name: backend
        resources:
          requests:
            memory: "384Mi"
            cpu: "200m"
          limits:
            memory: "768Mi"
            cpu: "400m"
EOF

# Apply optimized resources
kubectl apply -f optimized-resources.yaml
```

#### Step 10.3.3: Configure Horizontal Pod Autoscaler with Custom Metrics
```bash
# Install Prometheus Adapter
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus-adapter prometheus-community/prometheus-adapter \
  --namespace monitoring \
  --set prometheus.url=http://prometheus-operated.monitoring.svc.cluster.local \
  --set prometheus.port=9090

# Create HPA with custom metrics
cat > custom-hpa.yaml << EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-custom-hpa
  namespace: 3-tier-app-eks
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: 100
EOF

# Apply custom HPA
kubectl apply -f custom-hpa.yaml
```

---

## Phase 11: Security Hardening

### Step 11.1: Network Policy Implementation

#### Step 11.1.1: Install Calico Network Policy Provider
```bash
# Install Calico
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml

# Verify installation
kubectl get pods -n kube-system | grep calico
```

#### Step 11.1.2: Create Network Policies
```bash
# Create default deny policy
cat > default-deny.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: 3-tier-app-eks
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
EOF

# Create frontend network policy
cat > frontend-policy.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-policy
  namespace: 3-tier-app-eks
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - ipBlock:
        cidr: 0.0.0.0/0
    ports:
    - protocol: TCP
      port: 80
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 8000
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
EOF

# Create backend network policy
cat > backend-policy.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
  namespace: 3-tier-app-eks
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres-db
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
EOF

# Apply network policies
kubectl apply -f default-deny.yaml
kubectl apply -f frontend-policy.yaml
kubectl apply -f backend-policy.yaml
```

### Step 11.2: Pod Security Context

#### Step 11.2.1: Update Deployments with Security Context
```bash
# Update backend deployment with security context
cat > backend-security.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: 3-tier-app-eks
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 3000
        fsGroup: 2000
      containers:
      - name: backend
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
          readOnlyRootFilesystem: true
EOF

# Apply security context
kubectl apply -f backend-security.yaml
```

### Step 11.3: Secret Management with AWS Secrets Manager

#### Step 11.3.1: Store Secrets in AWS Secrets Manager
```bash
# Create secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name bootcamp-dev/db-credentials \
  --description "Database credentials for bootcamp-dev" \
  --secret-string '{"username":"postgres","password":"'$(openssl rand -base64 20)'","host":"bootcamp-dev-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com","port":"5432","dbname":"devopsdojo"}'

# Get secret ARN
SECRET_ARN=$(aws secretsmanager describe-secret --secret-id bootcamp-dev/db-credentials --query ARN --output text)
```

#### Step 11.3.2: Install External Secrets Operator
```bash
# Add Helm repository
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

# Install External Secrets Operator
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace

#
</augment_code_snippet>
