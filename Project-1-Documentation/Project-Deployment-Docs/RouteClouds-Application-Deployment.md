# RouteClouds E-Commerce Platform Deployment Guide (AWS EKS)

**Complete Step-by-Step Deployment Guide for RouteClouds E-Commerce Application with CI/CD Pipeline**

---

## Table of Contents

### Phase 1: Pre-Deployment Setup
1. [Prerequisites and Environment Setup](#prerequisites-and-environment-setup)
2. [Project Architecture Overview](#project-architecture-overview)
3. [Application Components Analysis](#application-components-analysis)
4. [Docker Hub and CI/CD Setup](#docker-hub-and-cicd-setup)

### Phase 2: Infrastructure Deployment
5. [Infrastructure Setup with Terraform](#infrastructure-setup-with-terraform)
6. [EKS Cluster Configuration](#eks-cluster-configuration)
7. [Network and Security Setup](#network-and-security-setup)

### Phase 3: Kubernetes Configuration
8. [Kubernetes Namespace and Secrets](#kubernetes-namespace-and-secrets)
9. [Database Service Configuration](#database-service-configuration)
10. [Database Connectivity Testing](#database-connectivity-testing)

### Phase 4: Application Deployment
11. [Database Migration Job](#database-migration-job)
12. [Backend Application Deployment](#backend-application-deployment)
13. [Frontend Application Deployment](#frontend-application-deployment)

### Phase 5: Load Balancer and Ingress
14. [AWS Load Balancer Controller Setup](#aws-load-balancer-controller-setup)
15. [Ingress Configuration and ALB Setup](#ingress-configuration-and-alb-setup)
16. [SSL/TLS Configuration](#ssltls-configuration)

### Phase 6: CI/CD Pipeline Validation
17. [GitHub Actions Pipeline Testing](#github-actions-pipeline-testing)
18. [Automated Deployment Verification](#automated-deployment-verification)
19. [Rollback Testing](#rollback-testing)

### Phase 7: Monitoring and Scaling
20. [Monitoring Setup (Prometheus/Grafana)](#monitoring-setup)
21. [Horizontal Pod Autoscaling](#horizontal-pod-autoscaling)
22. [Application Validation and Testing](#application-validation-and-testing)

### Phase 8: Post-Deployment
23. [Performance Optimization](#performance-optimization)
24. [Security Hardening](#security-hardening)
25. [Backup and Disaster Recovery](#backup-and-disaster-recovery)

---

## Prerequisites and Environment Setup

### Required Tools and Versions
- ✅ **AWS Account** with administrative access
- ✅ **AWS CLI** v2.x installed and configured
- ✅ **kubectl** v1.28+ installed
- ✅ **Terraform** v1.5+ installed
- ✅ **Docker** installed and running
- ✅ **Git** for repository management
- ✅ **Node.js** v18+ for local development
- ✅ **Docker Hub Account** (awsfreetier30)
- ✅ **GitHub Account** with repository access
- ✅ **eksctl** (optional but recommended)

### AWS Configuration
```bash
# Configure AWS CLI with your credentials
aws configure
# AWS Access Key ID: [Your Access Key]
# AWS Secret Access Key: [Your Secret Key]
# Default region name: us-east-1
# Default output format: json

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
node --version         # Should show Node.js 18.x+
npm --version          # Should show npm 9.x+
```

### Environment Variables Setup
```bash
# Set project-specific environment variables
export AWS_REGION="us-east-1"
export PROJECT_NAME="RouteClouds-Repo"
export ENVIRONMENT="prod"
export CLUSTER_NAME="routeclouds-prod-cluster"
export DOCKER_USERNAME="awsfreetier30"
export KUBE_NAMESPACE="routeclouds-ns"
```

### Docker Hub Setup
```bash
# Login to Docker Hub
docker login -u awsfreetier30

# Verify access to RouteClouds images
docker pull awsfreetier30/routeclouds-backend:latest
docker pull awsfreetier30/routeclouds-frontend:latest
```

---

## Docker Hub and CI/CD Setup

### GitHub Secrets Configuration

Before deploying, configure the following secrets in your GitHub repository:

**Repository Settings → Secrets and variables → Actions → New repository secret**

```bash
# Docker Hub Credentials
DOCKER_USERNAME = awsfreetier30
DOCKER_PASSWORD = 

# AWS Configuration
AWS_REGION = us-east-1
EKS_CLUSTER_NAME = routeclouds-prod-cluster
KUBE_NAMESPACE = routeclouds-ns
OIDC_ROLE_ARN = arn:aws:iam::YOUR_ACCOUNT:role/github-actions-role
```

### CI/CD Pipeline Overview

The GitHub Actions workflow automatically:

1. **🔍 Code Analysis**: Checkout and setup Node.js environment
2. **🧪 Build & Test**: Compile TypeScript, build applications
3. **🐳 Docker Build**: Create optimized production images
4. **📤 Push to Registry**: Upload to Docker Hub with version tags
5. **☸️ Deploy to EKS**: Update Kubernetes manifests and deploy
6. **✅ Health Checks**: Verify deployment success
7. **🔄 Rollback**: Automatic rollback on failure

### Manual Image Build (Optional)

```bash
# Build images locally for testing
cd RouteClouds-E-Comm-Project/

# Build backend
docker build -t awsfreetier30/routeclouds-backend:latest ./backend

# Build frontend
docker build -t awsfreetier30/routeclouds-frontend:latest ./frontend

# Test locally
docker-compose -f docker-compose.prod.yml up -d

# Push to Docker Hub
docker push awsfreetier30/routeclouds-backend:latest
docker push awsfreetier30/routeclouds-frontend:latest
```

---

## Project Architecture Overview

### 3-Tier Application Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Internet Gateway                          │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                    Application Load Balancer                       │
│                         (ALB)                                      │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────┐                ┌─────────────────┐
│   Frontend      │                │    Backend      │
│   (React.js)    │                │   (Flask API)   │
│   Port: 80      │                │   Port: 8000    │
│   Public Subnet │                │ Private Subnet  │
└─────────────────┘                └─────────┬───────┘
                                             │
                                             ▼
                                   ┌─────────────────┐
                                   │    Database     │
                                   │  (RDS PostgreSQL)│
                                   │   Port: 5432    │
                                   │ Private Subnet  │
                                   └─────────────────┘
```

### Component Details

#### Frontend Tier (Presentation Layer)
- **Technology**: React.js application
- **Container Port**: 80
- **Deployment**: Kubernetes Deployment with 2 replicas
- **Service**: ClusterIP service for internal communication
- **Access**: Via ALB path-based routing (`/` path)

#### Backend Tier (Application Layer)
- **Technology**: Python Flask REST API
- **Container Port**: 8000
- **Deployment**: Kubernetes Deployment with 2 replicas
- **Service**: ClusterIP service for internal communication
- **Access**: Via ALB path-based routing (`/api` path)

#### Database Tier (Data Layer)
- **Technology**: AWS RDS PostgreSQL
- **Port**: 5432
- **Access**: Via Kubernetes ExternalName service
- **Security**: Private subnet, security group restrictions

### Network Architecture
- **VPC**: Custom VPC with CIDR 10.0.0.0/16
- **Public Subnets**: 2 subnets across different AZs for ALB
- **Private Subnets**: 2 subnets for EKS worker nodes and RDS
- **NAT Gateway**: For outbound internet access from private subnets
- **Internet Gateway**: For inbound internet access to public subnets

---

## Application Components Analysis

### Frontend Application (React.js)

#### Dockerfile Analysis
```dockerfile
# Multi-stage build for optimized production image
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Key Features**:
- Multi-stage build for smaller production image
- Uses nginx as web server for serving static files
- Optimized for production with `npm ci --only=production`
- Custom nginx configuration for SPA routing

#### Frontend Configuration
- **Build Tool**: Create React App
- **Package Manager**: npm
- **Web Server**: nginx (production)
- **Port**: 80
- **Environment**: Production optimized

### Backend Application (Flask API)

#### Dockerfile Analysis
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
```

**Key Features**:
- Python 3.9 slim base image for smaller footprint
- Requirements installed via pip
- Application runs on port 8000
- Direct Python execution (suitable for development/demo)

#### Backend Dependencies
```python
# Key dependencies from requirements.txt
Flask==2.3.3
Flask-CORS==4.0.0
psycopg2-binary==2.9.7
SQLAlchemy==2.0.21
Flask-Migrate==4.0.5
```

#### API Endpoints
- **Health Check**: `GET /health`
- **Database Status**: `GET /api/status`
- **User Management**: CRUD operations for users
- **CORS**: Enabled for frontend communication

### Database Configuration

#### RDS PostgreSQL Setup
- **Engine**: PostgreSQL 14.x
- **Instance Class**: db.t3.micro (development)
- **Storage**: 20GB GP2
- **Multi-AZ**: Disabled (development)
- **Backup**: 7-day retention
- **Security**: VPC security groups, private subnets

#### Database Schema
```sql
-- Example schema structure
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Infrastructure Setup with Terraform

### Step 1: Project Structure Setup
```bash
# Clone and navigate to project
git clone <your-repository-url>
cd DevOps-Project-36/RouteClouds-E-Comm-Project/infra

# Verify project structure
ls -la
# Expected files:
# - terraform.tfvars
# - variables.tf
# - eks.tf
# - network.tf
# - rds.tf
# - outputs.tf
```

### Step 2: Configure Terraform Variables
```bash
# Review and update terraform.tfvars
cat terraform.tfvars
```

**Required Configuration:**
```hcl
# terraform.tfvars
aws_region   = "us-east-1"
environment  = "prod"
prefix       = "routeclouds"
project_name = "RouteClouds-Repo"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.3.0/24", "10.0.4.0/24"]

# EKS Configuration
cluster_version = "1.28"
node_instance_types = ["t3.medium"]
node_desired_size = 2
node_min_size = 2
node_max_size = 4

# RDS Configuration
db_instance_class = "db.t3.micro"
db_allocated_storage = 20
db_name = "postgres"
db_username = "postgres"
```

### Step 3: Pre-Deployment: AWS Secrets Manager Cleanup

**⚠️ Important**: Before running `terraform apply`, check for existing secrets that might conflict with the new deployment.

#### Check for Existing Secrets

```bash
# List all secrets in the region
aws secretsmanager list-secrets --region us-east-1

# Check specifically for RouteClouds secrets
aws secretsmanager list-secrets --region us-east-1 --query 'SecretList[?contains(Name, `routeclouds`) || contains(Name, `bootcamp`)]'

# Check for the specific secret that Terraform will create
aws secretsmanager describe-secret --secret-id db/routeclouds-prod-db --region us-east-1 2>/dev/null || echo "Secret does not exist - OK to proceed"
```

#### Handle Existing Secrets (If Found)

If you encounter the error: `InvalidRequestException: You can't create this secret because a secret with this name is already scheduled for deletion`, follow these steps:

**Option 1: Force Delete Without Recovery (Recommended for Development)**
```bash
# Force delete the existing secret immediately
aws secretsmanager delete-secret \
    --secret-id db/routeclouds-prod-db \
    --force-delete-without-recovery \
    --region us-east-1

# Verify deletion
aws secretsmanager describe-secret --secret-id db/routeclouds-prod-db --region us-east-1 2>/dev/null || echo "Secret successfully deleted"
```

**Option 2: Restore and Update (For Production)**
```bash
# If the secret is scheduled for deletion but you want to keep the data
aws secretsmanager restore-secret \
    --secret-id db/routeclouds-prod-db \
    --region us-east-1

# Then update the secret value if needed
aws secretsmanager update-secret \
    --secret-id db/routeclouds-prod-db \
    --description "Database credentials for RouteClouds production" \
    --region us-east-1
```

**Option 3: Use Different Secret Name (Alternative)**
```bash
# If you want to keep the old secret, modify the Terraform configuration
# Edit infra/rds.tf and change the secret name:
# name = "db/${aws_db_instance.postgres.identifier}-v2"
```

#### Verify Clean State

```bash
# Ensure no conflicting secrets exist
echo "🔍 Checking for conflicting secrets..."
EXISTING_SECRETS=$(aws secretsmanager list-secrets --region us-east-1 --query 'SecretList[?contains(Name, `routeclouds-prod-db`)].Name' --output text)

if [ -z "$EXISTING_SECRETS" ]; then
    echo "✅ No conflicting secrets found. Safe to proceed with Terraform."
else
    echo "⚠️  Found existing secrets: $EXISTING_SECRETS"
    echo "Please resolve conflicts before proceeding."
    exit 1
fi
```

### Step 4: Deploy Infrastructure with Terraform

```bash
# Initialize Terraform
terraform init

# Review the deployment plan
terraform plan

# Apply the infrastructure (takes 15-20 minutes)
terraform apply

# Confirm with 'yes' when prompted
```

**Expected Output:**
```
Apply complete! Resources: 25 added, 0 changed, 0 destroyed.

Outputs:
cluster_endpoint = "https://XXXXXXXXXX.gr7.us-east-1.eks.amazonaws.com"
cluster_name = "routeclouds-prod-cluster"
cluster_security_group_id = "sg-xxxxxxxxxx"
database_endpoint = "routeclouds-prod-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com"
vpc_id = "vpc-xxxxxxxxxx"
secret_arn = "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:db/routeclouds-prod-db-XXXXXX"
```

**⚠️ Important**: Note the `secret_arn` output - this confirms that the AWS Secrets Manager secret `db/routeclouds-prod-db` was successfully created by Terraform.

### Step 4: Configure kubectl for EKS

```bash
#Get Cluster name 
aws eks list-clusters --region us-east-1

kubectl config current-context
kubectl config view --minify
kubectl config view --minify -o jsonpath='{.clusters[0].name}'

# Update kubeconfig to connect to the new EKS cluster
aws eks update-kubeconfig --region us-east-1 --name routeclouds-prod-cluster

# Verify connection
kubectl get nodes

# Expected output: 2 nodes in Ready state
NAME                         STATUS   ROLES    AGE   VERSION
ip-10-0-3-xxx.ec2.internal   Ready    <none>   5m    v1.28.x-eks-xxxxxxx
ip-10-0-4-xxx.ec2.internal   Ready    <none>   5m    v1.28.x-eks-xxxxxxx
```

---

## EKS Cluster Configuration

### Cluster Components Verification

```bash
# Check cluster status
kubectl cluster-info

# Verify system pods
kubectl get pods -n kube-system

# Check node details
kubectl describe nodes
```

### EKS Add-ons Configuration

The Terraform configuration includes essential EKS add-ons:

1. **VPC CNI**: For pod networking
2. **CoreDNS**: For service discovery
3. **kube-proxy**: For service networking

```bash
# Verify add-ons are installed
kubectl get daemonset -n kube-system
kubectl get deployment -n kube-system coredns

# Check RDS instance
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier,`routeclouds-prod-db`)].DBInstanceStatus'
# Expected output: "available"

# Get Terraform outputs
terraform output
```

---

## Network and Security Setup

### VPC and Subnet Configuration

**VPC Details:**
- **CIDR**: 10.0.0.0/16
- **Public Subnets**: 10.0.1.0/24, 10.0.2.0/24 (for ALB)
- **Private Subnets**: 10.0.3.0/24, 10.0.4.0/24 (for EKS nodes and RDS)

### VPC and Subnet Manual Configuration for Load Balancer

**⚠️ Critical Step**: ALB requires properly tagged subnets to function correctly. This manual process ensures load balancer can identify and use the correct subnets.

#### Step 1: Get VPC ID from EKS Cluster

```bash
# Get the VPC ID from your EKS cluster
VPC_ID=$(aws eks describe-cluster --name routeclouds-prod-cluster --query 'cluster.resourcesVpcConfig.vpcId' --output text)
echo "VPC ID: $VPC_ID"

# Alternative method using terraform output
# VPC_ID=$(terraform output -raw vpc_id)
```

#### Step 2: List ALL Subnets in Your VPC

```bash
# List all subnets in the VPC with detailed information
aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[].{SubnetId:SubnetId,AvailabilityZone:AvailabilityZone,CidrBlock:CidrBlock,MapPublicIpOnLaunch:MapPublicIpOnLaunch,Tags:Tags[?Key==`Name`].Value|[0]}' \
    --output table

# Expected output shows subnets with their characteristics:
# - MapPublicIpOnLaunch: true = Public subnet
# - MapPublicIpOnLaunch: false = Private subnet
```

#### Step 3: Identify Public and Private Subnets

**⚠️ Important**: Due to Terraform configuration, public subnets may not have `MapPublicIpOnLaunch=true`. We'll identify them by name pattern instead.

```bash
echo "=== IDENTIFYING SUBNETS BY NAME PATTERN ==="

# Method 1: Identify by name pattern (more reliable for this setup)
PUBLIC_SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[?contains(Tags[?Key==`Name`].Value|[0], `public`)].SubnetId' \
    --output text)

echo "Public Subnets (identified by name): $PUBLIC_SUBNETS"

# Method 2: Fallback - try MapPublicIpOnLaunch filter
if [ -z "$PUBLIC_SUBNETS" ]; then
    echo "⚠️  No subnets found with 'public' in name, trying MapPublicIpOnLaunch filter..."
    PUBLIC_SUBNETS=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=true" \
        --query 'Subnets[].SubnetId' \
        --output text)
    echo "Public Subnets (by MapPublicIpOnLaunch): $PUBLIC_SUBNETS"
fi

# Method 3: Manual identification based on known pattern
if [ -z "$PUBLIC_SUBNETS" ]; then
    echo "🔍 Using manual subnet identification based on CIDR pattern..."
    # Public subnets typically use 10.0.101.0/24 and 10.0.102.0/24 in this setup
    PUBLIC_SUBNETS=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'Subnets[?CidrBlock==`10.0.101.0/24` || CidrBlock==`10.0.102.0/24`].SubnetId' \
        --output text)
    echo "Public Subnets (by CIDR pattern): $PUBLIC_SUBNETS"
fi

# Get private subnets (exclude RDS subnets and public subnets)
echo "=== IDENTIFYING PRIVATE SUBNETS ==="
PRIVATE_SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[?contains(Tags[?Key==`Name`].Value|[0], `private`) && !contains(Tags[?Key==`Name`].Value|[0], `RDS`)].SubnetId' \
    --output text)

echo "Private Subnets (for EKS nodes): $PRIVATE_SUBNETS"

# Verify we have at least 2 public subnets in different AZs (required for ALB)
PUBLIC_SUBNET_COUNT=$(echo $PUBLIC_SUBNETS | wc -w)
echo "Number of public subnets found: $PUBLIC_SUBNET_COUNT"

if [ $PUBLIC_SUBNET_COUNT -lt 2 ]; then
    echo "❌ ERROR: ALB requires at least 2 public subnets in different AZs"
    echo "Please verify your subnet identification or Terraform configuration"
    exit 1
else
    echo "✅ Found $PUBLIC_SUBNET_COUNT public subnets - sufficient for ALB"
fi
```

#### Step 4: Manually Select and Tag Public Subnets for ALB

**Important**: ALB requires at least 2 public subnets in different AZs.

```bash
# Convert space-separated subnet IDs to array for easier handling
PUBLIC_SUBNET_ARRAY=($PUBLIC_SUBNETS)

# Tag the first public subnet for ALB
aws ec2 create-tags \
    --resources ${PUBLIC_SUBNET_ARRAY[0]} \
    --tags Key=kubernetes.io/role/elb,Value=1

# Tag the second public subnet for ALB
aws ec2 create-tags \
    --resources ${PUBLIC_SUBNET_ARRAY[1]} \
    --tags Key=kubernetes.io/role/elb,Value=1

echo "Tagged public subnets: ${PUBLIC_SUBNET_ARRAY[0]} and ${PUBLIC_SUBNET_ARRAY[1]}"
```

#### Step 5: Tag Private Subnets for Internal Load Balancers

```bash
# Convert space-separated subnet IDs to array
PRIVATE_SUBNET_ARRAY=($PRIVATE_SUBNETS)

# Tag private subnets for internal load balancers
for subnet in "${PRIVATE_SUBNET_ARRAY[@]}"; do
    aws ec2 create-tags \
        --resources $subnet \
        --tags Key=kubernetes.io/role/internal-elb,Value=1
    echo "Tagged private subnet: $subnet"
done
```

#### Step 6: Verify Subnet Tags Were Applied

```bash
# Verify public subnet tags
echo "=== Public Subnet Tags ==="
for subnet in "${PUBLIC_SUBNET_ARRAY[@]}"; do
    echo "Subnet: $subnet"
    aws ec2 describe-tags \
        --filters "Name=resource-id,Values=$subnet" "Name=key,Values=kubernetes.io/role/elb" \
        --query 'Tags[].{Key:Key,Value:Value}' \
        --output table
done

# Verify private subnet tags
echo "=== Private Subnet Tags ==="
for subnet in "${PRIVATE_SUBNET_ARRAY[@]}"; do
    echo "Subnet: $subnet"
    aws ec2 describe-tags \
        --filters "Name=resource-id,Values=$subnet" "Name=key,Values=kubernetes.io/role/internal-elb" \
        --query 'Tags[].{Key:Key,Value:Value}' \
        --output table
done
```

#### Step 7: Complete Subnet Information Summary

```bash
# Generate a complete summary of subnet configuration
echo "=== VPC and Subnet Configuration Summary ==="
echo "VPC ID: $VPC_ID"
echo ""
echo "Public Subnets (Tagged for ALB):"
aws ec2 describe-subnets \
    --subnet-ids $PUBLIC_SUBNETS \
    --query 'Subnets[].{SubnetId:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock,Name:Tags[?Key==`Name`].Value|[0]}' \
    --output table

echo ""
echo "Private Subnets (Tagged for Internal ELB):"
aws ec2 describe-subnets \
    --subnet-ids $PRIVATE_SUBNETS \
    --query 'Subnets[].{SubnetId:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock,Name:Tags[?Key==`Name`].Value|[0]}' \
    --output table
```

#### Why These Tags Are Required

**For Public Subnets (`kubernetes.io/role/elb=1`)**:
- ALB controller uses this tag to identify subnets for internet-facing load balancers
- Must be in at least 2 different Availability Zones
- Must have route to Internet Gateway

**For Private Subnets (`kubernetes.io/role/internal-elb=1`)**:
- Used for internal load balancers (if needed)
- EKS nodes typically reside in these subnets
- Must have route to NAT Gateway for outbound internet access

#### Troubleshooting Subnet Issues

```bash
# Check if subnets have proper routes
echo "=== Route Table Information ==="
aws ec2 describe-route-tables \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'RouteTables[].{RouteTableId:RouteTableId,Routes:Routes[].{Destination:DestinationCidrBlock,Gateway:GatewayId,Target:NatGatewayId},Associations:Associations[].SubnetId}' \
    --output json

# Verify Internet Gateway exists
aws ec2 describe-internet-gateways \
    --filters "Name=attachment.vpc-id,Values=$VPC_ID" \
    --query 'InternetGateways[].{IGW:InternetGatewayId,State:Attachments[0].State}' \
    --output table

# Verify NAT Gateway exists
aws ec2 describe-nat-gateways \
    --filter "Name=vpc-id,Values=$VPC_ID" \
    --query 'NatGateways[].{NatGatewayId:NatGatewayId,SubnetId:SubnetId,State:State}' \
    --output table
```



---

## Kubernetes Namespace and Secrets

### Step 1: Navigate to Kubernetes Manifests

```bash
# Navigate to k8s directory
cd ../k8s/

# Verify manifest files
ls -la
# Expected files: namespace.yaml, secrets.yaml, configmap.yaml, etc.
```

### Step 2: Create Namespace

```bash
# Create the application namespace
kubectl apply -f namespace.yaml

# Verify namespace creation
kubectl get namespaces
kubectl describe namespace routeclouds-ns
```

### Step 3: Database Secrets Configuration

**⚠️ Critical Step**: Database credentials must be synchronized with AWS Secrets Manager.

**📋 Important Note**: Terraform automatically creates the secret `db/routeclouds-prod-db` during infrastructure deployment. The secret contains a PostgreSQL connection string in the format:
```
postgresql://username:password@host:port/database
```

#### Verify Terraform-Created Secret

```bash
# Verify the secret was created by Terraform
aws secretsmanager describe-secret --secret-id db/routeclouds-prod-db --region us-east-1

# Get the secret value to verify format
aws secretsmanager get-secret-value \
    --secret-id db/routeclouds-prod-db \
    --region us-east-1 \
    --query SecretString \
    --output text

# Expected format: postgresql://routeclouds_user:RANDOM_PASSWORD@routeclouds-prod-db.XXXXX.us-east-1.rds.amazonaws.com:5432/routeclouds_ecommerce_db
```

#### Method A: Automated Synchronization (Recommended)

```bash
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

**If Script Succeeds**: ✅ Skip to Step 4 (Apply Secrets)
**If Script Fails**: ⚠️ Continue to Method B (Manual Process)

#### Method B: Manual Credential Synchronization (If Automated Fails)

```bash
# B.1: Get current credentials from AWS Secrets Manager
echo "🔍 Retrieving database credentials..."
SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id db/routeclouds-prod-db \
    --region us-east-1 \
    --query SecretString \
    --output text)

echo "✅ Retrieved connection string: $SECRET_VALUE"

# B.2: Parse the connection string components
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

# B.3: Create or update Kubernetes secret with current credentials
echo "🔄 Creating/updating Kubernetes secret..."

# Check if secret exists and create or update accordingly
if kubectl get secret db-secrets -n routeclouds-ns >/dev/null 2>&1; then
    echo "Secret exists, updating..."
    kubectl patch secret db-secrets -n routeclouds-ns --type='merge' -p="{
      \"data\": {
        \"DB_HOST\": \"$(echo -n "$DB_HOST" | base64 -w 0)\",
        \"DB_USER\": \"$(echo -n "$DB_USER" | base64 -w 0)\",
        \"DB_PASSWORD\": \"$(echo -n "$DB_PASSWORD" | base64 -w 0)\",
        \"DB_NAME\": \"$(echo -n "$DB_NAME" | base64 -w 0)\",
        \"DATABASE_URL\": \"$(echo -n "$SECRET_VALUE" | base64 -w 0)\"
      }
    }"
    echo "✅ Kubernetes secret updated successfully!"
else
    echo "Secret doesn't exist, creating new one..."
    kubectl create secret generic db-secrets \
        --from-literal=DB_HOST="$DB_HOST" \
        --from-literal=DB_USER="$DB_USER" \
        --from-literal=DB_PASSWORD="$DB_PASSWORD" \
        --from-literal=DB_NAME="$DB_NAME" \
        --from-literal=DATABASE_URL="$SECRET_VALUE" \
        -n routeclouds-ns
    echo "✅ Kubernetes secret created successfully!"
fi
```

#### Method C: Database Connectivity Verification

```bash
# C.1: Verify secret synchronization
echo "🔍 Verifying credential synchronization..."
K8S_PASSWORD=$(kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)
AWS_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

if [ "$K8S_PASSWORD" = "$AWS_PASSWORD" ]; then
    echo "✅ Credentials are synchronized!"
else
    echo "❌ Credential mismatch detected!"
    echo "Please re-run the synchronization process."
    exit 1
fi

# C.2: Clean up any existing test pods
echo "🧹 Cleaning up any existing test pods..."
kubectl delete pod db-connectivity-test -n routeclouds-ns --ignore-not-found=true

# Wait a moment for cleanup
sleep 2

# C.3: Test database connectivity from within cluster
echo "🧪 Testing database connectivity..."
kubectl run db-connectivity-test --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash -c "
PGPASSWORD='$DB_PASSWORD' psql -h '$DB_HOST' -U '$DB_USER' -d '$DB_NAME' -c 'SELECT version();'
"

echo "🎉 Database connectivity verification completed!"

# C.4: Manual cleanup (if needed)
echo "📝 Manual cleanup commands (if test pod gets stuck):"
echo "   kubectl delete pod db-connectivity-test -n routeclouds-ns --force --grace-period=0"
echo "   kubectl get pods -n routeclouds-ns | grep db-connectivity-test"
```

### Step 4: Apply Secrets and ConfigMap

```bash
# Apply secrets (contains database credentials)
kubectl apply -f secrets.yaml

# Apply configmap (contains non-sensitive configuration)
kubectl apply -f configmap.yaml

# Verify secrets creation
kubectl get secrets -n routeclouds-ns
kubectl describe secret db-secrets -n routeclouds-ns
```

---

## Database Service Configuration

### Step 1: Deploy Database Service

The database service uses ExternalName type to connect to AWS RDS:

```yaml
# database-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-db
  namespace: routeclouds-ns
spec:
  type: ExternalName
  externalName: routeclouds-prod-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com
  ports:
  - port: 5432
```

```bash
# Deploy database service
kubectl apply -f database-service.yaml

# Verify service creation
kubectl get svc -n routeclouds-ns postgres-db
kubectl describe svc postgres-db -n routeclouds-ns
```

### Step 2: Verify Database Endpoint

```bash
# Check if the RDS endpoint is correctly configured
kubectl get svc postgres-db -n routeclouds-ns -o yaml | grep externalName
```

---

## Database Connectivity Testing

### Automated Credential Synchronization (Recommended)

```bash
# Run the automated script that:
# 1. Retrieves current credentials from AWS Secrets Manager
# 2. Updates Kubernetes secrets with correct credentials
# 3. Tests database connectivity automatically
./update-db-secrets.sh
```

**Expected Output:**
```
🔍 Retrieving database credentials from AWS Secrets Manager...
✅ Retrieved secret from AWS Secrets Manager
📋 Parsed credentials:
  DB_HOST: routeclouds-prod-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com
  DB_USER: postgres
  DB_NAME: postgres
  DB_PASSWORD: [HIDDEN]
🔄 Updating Kubernetes secret...
✅ Kubernetes secret updated successfully!
🧪 Testing database connectivity...
PostgreSQL 14.15 on x86_64-pc-linux-gnu, compiled by gcc...
🎉 Database connectivity test completed!
```

### Manual Connectivity Testing (If Automated Fails)

```bash
# Step 1: Get current database credentials
SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id db/routeclouds-prod-db \
    --region us-east-1 \
    --query SecretString \
    --output text)

# Step 2: Extract password from connection string
DB_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Step 3: Test DNS resolution
kubectl run dns-test --rm -it --restart=Never --image=tutum/dnsutils -n routeclouds-ns -- dig postgres-db.routeclouds-ns.svc.cluster.local

# Step 4: Test database connectivity
kubectl run db-connectivity-test --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash -c "
PGPASSWORD='$DB_PASSWORD' psql -h postgres-db.routeclouds-ns.svc.cluster.local -U postgres -d postgres -c 'SELECT version();'
"
```

### Success Criteria
- ✅ DNS resolution returns valid IP address
- ✅ Database connection succeeds without authentication errors
- ✅ PostgreSQL version query returns results
- ✅ No timeout or network errors

---

## Database Migration Job

### Step 1: Deploy Migration Job

The migration job initializes the database schema before application deployment:

```bash
# Deploy database migration job
kubectl apply -f migration_job.yaml

# Monitor migration job progress
kubectl get jobs -n routeclouds-ns
kubectl logs job/database-migration -n routeclouds-ns -f
```

**Expected Output:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> abc123, Initial migration
Migration completed successfully!
```

### Step 2: Verify Migration Success

```bash
# Check job completion status
kubectl get jobs -n routeclouds-ns
# Status should show: COMPLETIONS: 1/1

# Get database credentials from secrets
DB_PASSWORD=$(kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)
DB_HOST=$(kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_HOST}' | base64 -d)
DB_USER=$(kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_USER}' | base64 -d)
DB_NAME=$(kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_NAME}' | base64 -d)

echo "Connecting to: $DB_HOST as $DB_USER to database $DB_NAME"

# Verify database tables were created
kubectl run db-verify --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash -c "
PGPASSWORD='$DB_PASSWORD' psql -h '$DB_HOST' -U '$DB_USER' -d '$DB_NAME' -c '\dt'"

# Alternative: Check if specific tables exist
kubectl run db-verify-tables --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash -c "
PGPASSWORD='$DB_PASSWORD' psql -h '$DB_HOST' -U '$DB_USER' -d '$DB_NAME' -c 'SELECT table_name FROM information_schema.tables WHERE table_schema = '\''public'\'';'"
```

---

## Backend Application Deployment

### Step 1: Deploy Backend Application

```bash
# Deploy backend deployment and service
kubectl apply -f backend.yaml

# Monitor backend deployment
kubectl get deployment backend -n routeclouds-ns -w
```

### Step 2: Verify Backend Deployment

```bash
# Check deployment status
kubectl get deployment backend -n routeclouds-ns
kubectl get pods -n routeclouds-ns -l app=backend

# Check backend logs
kubectl logs -n routeclouds-ns -l app=backend --tail=50

# Expected log output:
# * Running on all addresses (0.0.0.0)
# * Running on http://127.0.0.1:8000
# * Running on http://10.0.x.x:8000
```

### Step 3: Test Backend Service

```bash
# Get backend service details
kubectl get svc backend -n routeclouds-ns

# Test backend health endpoint
kubectl run backend-test --rm -it --image=curlimages/curl -n routeclouds-ns --restart=Never -- curl http://backend.routeclouds-ns.svc.cluster.local:8000/health

# Expected response: {"status": "healthy"}
```

### Backend Configuration Details

**Deployment Specifications:**
- **Replicas**: 2 (for high availability)
- **Container Port**: 8000
- **Resource Limits**: 500m CPU, 512Mi memory
- **Environment Variables**: Loaded from secrets and configmap
- **Health Checks**: Liveness and readiness probes

**Service Configuration:**
- **Type**: ClusterIP (internal access only)
- **Port**: 8000
- **Selector**: app=backend

---

## Frontend Application Deployment

### Step 1: Deploy Frontend Application

```bash
# Deploy frontend deployment and service
kubectl apply -f frontend.yaml

# Monitor frontend deployment
kubectl get deployment frontend -n routeclouds-ns -w
```

### Step 2: Verify Frontend Deployment

```bash
# Check deployment status
kubectl get deployment frontend -n routeclouds-ns
kubectl get pods -n routeclouds-ns -l app=frontend

# Check frontend logs
kubectl logs -n routeclouds-ns -l app=frontend --tail=20
```

### Step 3: Test Frontend Service

```bash
# Get frontend service details
kubectl get svc frontend -n routeclouds-ns

# Test frontend service
kubectl run frontend-test --rm -it --image=curlimages/curl -n routeclouds-ns --restart=Never -- curl http://frontend.routeclouds-ns.svc.cluster.local:80

# Should return HTML content of the React app
```

### Frontend Configuration Details

**Deployment Specifications:**
- **Replicas**: 2 (for high availability)
- **Container Port**: 80
- **Resource Limits**: 250m CPU, 256Mi memory
- **Web Server**: nginx serving static React build
- **Health Checks**: HTTP GET on port 80

**Service Configuration:**
- **Type**: ClusterIP (internal access only)
- **Port**: 80
- **Selector**: app=frontend

---

## AWS Load Balancer Controller Setup

### Step 1: Download and Create IAM Policy for ALB Controller

```bash
# Navigate to k8s directory where the updated IAM policy file is located
cd RouteClouds-E-Comm-Project/k8s/

# Verify the updated IAM policy file exists (includes DescribeListenerAttributes permission)
ls -la iam_policy.json
echo "Using local iam_policy.json file with latest permissions (v2.11.0 compatible)"

# Check if policy already exists
aws iam get-policy --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy 2>/dev/null || echo "Policy does not exist - will create new one"

# Create IAM policy for ALB controller using the updated local file
aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json

# Note the policy ARN from output
echo "Policy ARN: arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy"

# If policy already exists, update it with the latest version
# aws iam create-policy-version \
#     --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
#     --policy-document file://iam_policy.json \
#     --set-as-default
```

### Step 2: Create IAM Service Account

```bash
# Check if service account already exists
eksctl get iamserviceaccount \
  --cluster=routeclouds-prod-cluster \
  --name=aws-load-balancer-controller \
  --namespace=kube-system 2>/dev/null || echo "Service account does not exist - will create new one"

# Create service account with IAM role
eksctl create iamserviceaccount \
  --cluster=routeclouds-prod-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Verify service account creation
kubectl get serviceaccount aws-load-balancer-controller -n kube-system
kubectl describe serviceaccount aws-load-balancer-controller -n kube-system
```

### Step 3: Install AWS Load Balancer Controller

```bash
# Add EKS Helm repository
helm repo add eks https://aws.github.io/eks-charts
helm repo update

# Install AWS Load Balancer Controller
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=routeclouds-prod-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### Step 4: Verify Controller Installation

```bash
# Check controller deployment status
echo "=== ALB Controller Deployment Status ==="
kubectl get deployment -n kube-system aws-load-balancer-controller

# Wait for deployment to be ready
echo "=== Waiting for ALB Controller to be Ready ==="
kubectl wait --for=condition=available --timeout=300s deployment/aws-load-balancer-controller -n kube-system

# Check controller pods
echo "=== ALB Controller Pods ==="
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# Check controller logs (last 20 lines)
echo "=== ALB Controller Logs (Recent) ==="
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=20

# Verify webhook configuration
echo "=== Webhook Configuration ==="
kubectl get validatingwebhookconfiguration aws-load-balancer-webhook

# Verify service account and OIDC
echo "=== Service Account Verification ==="
kubectl get serviceaccount aws-load-balancer-controller -n kube-system -o yaml

# Check if ALB controller can discover subnets
echo "=== Subnet Discovery Check ==="
kubectl logs -n kube-system deployment/aws-load-balancer-controller | grep -i subnet || echo "Check ALB controller logs for subnet discovery"

# Verify controller is ready to handle ingress
echo "=== Controller Readiness Check ==="
kubectl get deployment aws-load-balancer-controller -n kube-system -o jsonpath='{.status.conditions[?(@.type=="Available")].status}'
echo ""
```

---

## Ingress Configuration and ALB Setup

### Step 1: Deploy Ingress Resource

```bash
# Deploy ingress configuration
kubectl apply -f ingress.yaml

# Monitor ingress creation
kubectl get ingress -n routeclouds-ns -w
```

### Step 2: Verify ALB Creation

```bash
# Check ingress status
kubectl describe ingress routeclouds-ingress -n routeclouds-ns

# Get ALB DNS name
kubectl get ingress routeclouds-ingress -n routeclouds-ns -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Verify ALB in AWS Console or CLI
aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `k8s-3tierapp`)].{Name:LoadBalancerName,DNS:DNSName,State:State.Code}'
```

### Ingress Configuration Details

**Path-Based Routing:**
- `/api/*` → Backend service (port 8000)
- `/*` → Frontend service (port 80)

**ALB Annotations:**
- `alb.ingress.kubernetes.io/scheme: internet-facing`
- `alb.ingress.kubernetes.io/target-type: ip`
- `alb.ingress.kubernetes.io/healthcheck-path: /`

### Step 3: Test Application Access

```bash
# Get ALB DNS name
ALB_DNS=$(kubectl get ingress routeclouds-ingress -n routeclouds-ns -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test frontend access
curl -I http://$ALB_DNS/

# Test backend API access
curl http://$ALB_DNS/api/health

# Expected responses:
# Frontend: HTTP 200 with HTML content
# Backend: {"status": "healthy"}
```

---

## SSL/TLS Configuration

### Step 1: Install cert-manager (Optional)

For production deployments with custom domains:

```bash
# Install cert-manager for automatic SSL certificate management
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Verify cert-manager installation
kubectl get pods -n cert-manager
```

### Step 2: Configure SSL Ingress (Optional)

```bash
# Apply SSL-enabled ingress (if using custom domain)
kubectl apply -f ingress-with-tls.yaml

# Monitor certificate issuance
kubectl get certificates -n routeclouds-ns
kubectl describe certificate tls-secret -n routeclouds-ns
```

---

## Monitoring Setup

### Step 1: Deploy Monitoring Stack

```bash
# Deploy Prometheus and Grafana
kubectl apply -f monitoring/

# Monitor deployment progress
kubectl get pods -n routeclouds-ns -l app=prometheus
kubectl get pods -n routeclouds-ns -l app=grafana
```

### Step 2: Configure Monitoring Ingress

```bash
# Deploy monitoring ingress for Grafana access
kubectl apply -f monitoring-ingress.yaml

# Get Grafana access URL
kubectl get ingress monitoring-ingress -n routeclouds-ns -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### Step 3: Access Grafana Dashboard

```bash
# Get Grafana admin password
kubectl get secret grafana-admin-secret -n routeclouds-ns -o jsonpath='{.data.password}' | base64 -d

# Access Grafana at: http://<ALB-DNS>/grafana
# Username: admin
# Password: <decoded-password>
```

### Monitoring Components

**Prometheus Configuration:**
- Scrapes metrics from backend application
- Monitors Kubernetes cluster metrics
- Stores metrics with 15-day retention

**Grafana Dashboards:**
- Application performance metrics
- Infrastructure monitoring
- Custom alerts and notifications

---

## Horizontal Pod Autoscaling

### Step 1: Deploy HPA Configuration

```bash
# Deploy HPA for backend and frontend
kubectl apply -f hpa.yaml

# Verify HPA creation
kubectl get hpa -n routeclouds-ns
```

### Step 2: Test Autoscaling

```bash
# Generate load to test autoscaling
kubectl run load-generator --rm -it --image=busybox -n routeclouds-ns --restart=Never -- /bin/sh -c "while true; do wget -q -O- http://backend.routeclouds-ns.svc.cluster.local:8000/api/health; done"

# Monitor HPA scaling
kubectl get hpa -n routeclouds-ns -w
kubectl get pods -n routeclouds-ns -l app=backend -w
```

### HPA Configuration Details

**Backend HPA:**
- Target CPU: 70%
- Min replicas: 2
- Max replicas: 10

**Frontend HPA:**
- Target CPU: 70%
- Min replicas: 2
- Max replicas: 5

---

## Application Validation and Testing

### Step 1: Comprehensive Health Checks

```bash
# Check all deployments
kubectl get deployments -n routeclouds-ns

# Check all services
kubectl get services -n routeclouds-ns

# Check all pods
kubectl get pods -n routeclouds-ns

# Check ingress status
kubectl get ingress -n routeclouds-ns
```

### Step 2: End-to-End Testing

```bash
# Get application URL
APP_URL=$(kubectl get ingress routeclouds-ingress -n routeclouds-ns -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test frontend
echo "Testing Frontend..."
curl -s -o /dev/null -w "%{http_code}" http://$APP_URL/
# Expected: 200

# Test backend API
echo "Testing Backend API..."
curl -s http://$APP_URL/api/health
# Expected: {"status": "healthy"}

# Test database connectivity through API
curl -s http://$APP_URL/api/status
# Expected: {"database": "connected", "status": "ok"}
```

### Step 3: Performance Testing

```bash
# Install Apache Bench for load testing
sudo apt-get update && sudo apt-get install -y apache2-utils

# Test frontend performance
ab -n 1000 -c 10 http://$APP_URL/

# Test backend API performance
ab -n 1000 -c 10 http://$APP_URL/api/health

# Monitor resource usage during testing
kubectl top pods -n routeclouds-ns
kubectl top nodes
```

---

## Performance Optimization

### Resource Optimization

```bash
# Review resource usage
kubectl top pods -n routeclouds-ns
kubectl describe nodes

# Optimize resource requests and limits based on usage
kubectl patch deployment backend -n routeclouds-ns -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"requests":{"cpu":"200m","memory":"256Mi"},"limits":{"cpu":"500m","memory":"512Mi"}}}]}}}}'
```

### Database Connection Optimization

```yaml
# Backend environment variables for connection pooling
env:
- name: DB_POOL_SIZE
  value: "10"
- name: DB_MAX_OVERFLOW
  value: "20"
- name: DB_POOL_TIMEOUT
  value: "30"
```

---

## Security Hardening

### Step 1: Network Policies

```bash
# Apply network policies for micro-segmentation
kubectl apply -f network-policies.yaml

# Verify network policies
kubectl get networkpolicies -n routeclouds-ns
```

### Step 2: Pod Security Standards

```bash
# Apply pod security standards
kubectl label namespace routeclouds-ns pod-security.kubernetes.io/enforce=restricted
kubectl label namespace routeclouds-ns pod-security.kubernetes.io/audit=restricted
kubectl label namespace routeclouds-ns pod-security.kubernetes.io/warn=restricted
```

### Step 3: RBAC Configuration

```bash
# Apply RBAC policies
kubectl apply -f rbac.yaml

# Verify RBAC configuration
kubectl get roles,rolebindings -n routeclouds-ns
```

---

## Backup and Disaster Recovery

### Database Backup

```bash
# Enable automated RDS backups (configured in Terraform)
# Backup retention: 7 days
# Backup window: 03:00-04:00 UTC
# Maintenance window: Sun:04:00-Sun:05:00 UTC

# Manual backup creation
aws rds create-db-snapshot \
    --db-instance-identifier routeclouds-prod-db \
    --db-snapshot-identifier routeclouds-prod-db-manual-$(date +%Y%m%d%H%M%S)
```

### Application Configuration Backup

```bash
# Backup Kubernetes configurations
kubectl get all,secrets,configmaps,ingress -n routeclouds-ns -o yaml > 3-tier-app-backup-$(date +%Y%m%d).yaml

# Store backup in S3 (optional)
aws s3 cp 3-tier-app-backup-$(date +%Y%m%d).yaml s3://your-backup-bucket/kubernetes-backups/
```

---

## Deployment Validation Checklist

### ✅ Infrastructure Validation
- [ ] EKS cluster is active and accessible
- [ ] Worker nodes are in Ready state (minimum 2 nodes)
- [ ] RDS instance is available and accessible
- [ ] VPC and subnets are properly configured
- [ ] Security groups allow required traffic

### ✅ Application Validation
- [ ] All pods are running and ready
- [ ] Services are accessible within cluster
- [ ] Database migration completed successfully
- [ ] Application logs show no errors

### ✅ Load Balancer Validation
- [ ] ALB is provisioned and active
- [ ] Ingress shows correct ALB address
- [ ] Frontend accessible via ALB DNS
- [ ] Backend API accessible via ALB DNS
- [ ] Health checks are passing

### ✅ Monitoring Validation
- [ ] Prometheus is collecting metrics
- [ ] Grafana dashboards are accessible
- [ ] HPA is configured and responsive
- [ ] Alerts are configured (if applicable)

### ✅ Security Validation
- [ ] Database is in private subnet
- [ ] Application pods have resource limits
- [ ] Network policies are applied
- [ ] RBAC is configured

---

## Common Issues and Quick Fixes

### Issue 1: AWS Secrets Manager Conflicts

#### Problem: Secret Already Scheduled for Deletion
```
Error: creating Secrets Manager Secret: InvalidRequestException:
You can't create this secret because a secret with this name is already scheduled for deletion.
```

**Root Cause**: AWS Secrets Manager keeps deleted secrets for a recovery period (7-30 days) before permanent deletion.

**Solution**:
```bash
# Check secret status
aws secretsmanager describe-secret --secret-id db/routeclouds-prod-db --region us-east-1

# Option 1: Force delete immediately (Development)
aws secretsmanager delete-secret \
    --secret-id db/routeclouds-prod-db \
    --force-delete-without-recovery \
    --region us-east-1

# Option 2: Restore and reuse (Production)
aws secretsmanager restore-secret \
    --secret-id db/routeclouds-prod-db \
    --region us-east-1
```

#### Problem: Secret Access Denied
```
Error: AccessDenied: User is not authorized to perform: secretsmanager:GetSecretValue
```

**Solution**:
```bash
# Check current IAM permissions
aws sts get-caller-identity

# Verify IAM policy includes required permissions
aws iam list-attached-user-policies --user-name YOUR_USERNAME
aws iam list-attached-role-policies --role-name YOUR_ROLE

# Required permissions for Secrets Manager:
# - secretsmanager:GetSecretValue
# - secretsmanager:DescribeSecret
# - secretsmanager:CreateSecret
# - secretsmanager:UpdateSecret
```

#### Problem: Secret Not Found After Terraform Apply
```
Error: secret "db/routeclouds-prod-db" not found
```

**Solution**:
```bash
# Verify Terraform created the secret
terraform output secret_arn

# List all secrets to confirm creation
aws secretsmanager list-secrets --region us-east-1 | grep routeclouds

# Check Terraform state
terraform state list | grep secretsmanager
terraform state show aws_secretsmanager_secret.db_link
```

### Issue 2: Pods Not Starting
```bash
# Check pod status and events
kubectl describe pod <pod-name> -n routeclouds-ns
kubectl logs <pod-name> -n routeclouds-ns

# Common causes:
# - Image pull errors
# - Resource constraints
# - Configuration errors
```

### Issue 2: Database Secret Not Found Error

#### Problem: Secret "db-secrets" not found
```
Error from server (NotFound): secrets "db-secrets" not found
```

**Root Cause**: The Kubernetes secret `db-secrets` hasn't been created yet, but the script is trying to patch (update) it.

**Solution**:
```bash
# Option 1: Use the fixed script (recommended)
cd RouteClouds-E-Comm-Project/k8s
./update-db-secrets.sh

# Option 2: Create the secret manually first
kubectl create secret generic db-secrets \
    --from-literal=DB_HOST="$DB_HOST" \
    --from-literal=DB_USER="$DB_USER" \
    --from-literal=DB_PASSWORD="$DB_PASSWORD" \
    --from-literal=DB_NAME="$DB_NAME" \
    --from-literal=DATABASE_URL="$SECRET_VALUE" \
    -n routeclouds-ns

# Option 3: Apply the secrets.yaml file first
kubectl apply -f secrets.yaml

# Then run the synchronization
./update-db-secrets.sh
```

### Issue 2b: kubectl apply Warning for Secrets

#### Problem: Missing annotation warning when applying secrets.yaml
```
Warning: resource secrets/db-secrets is missing the kubectl.kubernetes.io/last-applied-configuration annotation
```

**Root Cause**: Secret was created imperatively (script) but now being managed declaratively (YAML).

**This is SAFE**: Kubernetes automatically patches the annotation and continues successfully.

**To avoid the warning**:
```bash
# Option 1: Use only declarative approach
kubectl delete secret db-secrets -n routeclouds-ns
kubectl apply -f secrets.yaml
./update-db-secrets.sh  # Will update existing secret

# Option 2: Use only imperative approach
# Skip secrets.yaml, just use the script
./update-db-secrets.sh
```

### Issue 3: Test Pod Already Exists Error

#### Problem: Database connectivity test pod already exists
```
Error from server (AlreadyExists): pods "db-connectivity-test" already exists
```

**Root Cause**: A previous test pod wasn't cleaned up properly.

**Solution**:
```bash
# Option 1: Delete the existing pod
kubectl delete pod db-connectivity-test -n routeclouds-ns

# Option 2: Force delete if stuck
kubectl delete pod db-connectivity-test -n routeclouds-ns --force --grace-period=0

# Option 3: Check pod status first
kubectl get pods -n routeclouds-ns | grep db-connectivity-test

# Then run the script again
./update-db-secrets.sh
```

### Issue 4: Migration Job Not Completing

#### Problem: Database migration job stuck or failing
```
NAME                 COMPLETIONS   DURATION   AGE
database-migration   0/1           41s        41s
```

**Common Causes**: Image pull errors, missing secrets/configmaps, container start failures.

**Diagnostic Steps**:
```bash
# 1. Check job and pod status
kubectl get jobs -n routeclouds-ns
kubectl get pods -n routeclouds-ns | grep migration

# 2. Check pod details and events
POD_NAME=$(kubectl get pods -n routeclouds-ns | grep migration | head -1 | awk '{print $1}')
kubectl describe pod $POD_NAME -n routeclouds-ns

# 3. Check pod logs
kubectl logs $POD_NAME -n routeclouds-ns

# 4. Verify dependencies exist
kubectl get secret db-secrets -n routeclouds-ns
kubectl get configmap app-config -n routeclouds-ns
```

**Solutions**:
```bash
# Option 1: Delete and recreate job
kubectl delete job database-migration -n routeclouds-ns
kubectl apply -f migration_job.yaml

# Option 2: Run test migration job first
kubectl apply -f test-migration-job.yaml
kubectl logs job/test-migration -n routeclouds-ns -f

# Option 3: Check Docker image
docker pull awsfreetier30/routeclouds-backend:latest

# Option 4: Ensure all dependencies exist
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
./update-db-secrets.sh
```

### Issue 5: Database Connection Failures
```bash
# Run credential synchronization script
./update-db-secrets.sh

# Verify database service
kubectl get svc postgres-db -n routeclouds-ns
```

### Issue 3: ALB Not Creating
```bash
# Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller

# Verify subnet tags
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$(terraform output -raw vpc_id)" --query 'Subnets[].Tags'
```

---

## Next Steps

After successful deployment:

1. **Set up CI/CD Pipeline**: Implement automated deployments
2. **Configure Custom Domain**: Set up Route53 and SSL certificates
3. **Implement Logging**: Set up centralized logging with ELK stack
4. **Security Scanning**: Implement container and infrastructure scanning
5. **Cost Optimization**: Review and optimize resource usage

---

## Summary

This deployment guide provides a comprehensive, step-by-step approach to deploying a 3-tier application on AWS EKS. The architecture includes:

- **Scalable Infrastructure**: EKS cluster with auto-scaling capabilities
- **High Availability**: Multi-AZ deployment with load balancing
- **Security**: Network isolation, RBAC, and security groups
- **Monitoring**: Prometheus and Grafana for observability
- **Automation**: Infrastructure as Code with Terraform

The deployment is production-ready and follows AWS and Kubernetes best practices for security, scalability, and maintainability.

---

## CI/CD Integration (Phase 6)

### Step 1: GitHub Actions OIDC Setup

**File Location:** `DevOps-Project-36/routeclouds-ns/.github/workflows/deploy.yml`

#### Step 1.1: Configure OIDC Provider for GitHub Actions

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

#### Step 1.2: Set Up GitHub Repository Secrets

Configure the following secrets in your GitHub repository:

- `AWS_REGION`: The AWS region (e.g., us-east-1)
- `EKS_CLUSTER_NAME`: The name of your EKS cluster (e.g., routeclouds-prod-cluster)
- `KUBE_NAMESPACE`: The Kubernetes namespace (e.g., routeclouds-ns)
- `OIDC_ROLE_ARN`: The ARN of the IAM role for GitHub Actions
- `ECR_BACKEND_REPO`: The ECR repository URL for the backend image
- `ECR_FRONTEND_REPO`: The ECR repository URL for the frontend image

#### Step 1.3: Configure GitHub Actions Workflow

The workflow file is already created at `.github/workflows/deploy.yml`. It includes:

- Building and testing the application
- Building and pushing Docker images to ECR
- Deploying to EKS
- Smoke testing
- Automatic rollback on failure

```bash
# Navigate to the GitHub Actions workflow directory
cd DevOps-Project-36/routeclouds-ns/.github/workflows/

# Review the workflow file
cat deploy.yml
```

#### Step 1.4: Trigger CI/CD Pipeline

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

## Comprehensive Validation and Testing (Phase 7)

### Step 1: Automated Deployment Validation

**File Location:** `DevOps-Project-36/routeclouds-ns/k8s/validate-deployment.sh`

```bash
# Navigate to k8s directory
cd DevOps-Project-36/routeclouds-ns/k8s

# Make the validation script executable
chmod +x validate-deployment.sh

# Run the validation script
./validate-deployment.sh
```

The validation script checks:
- Namespace existence
- Deployment status (backend, frontend)
- Service availability (backend, frontend, postgres-db)
- Ingress configuration
- ALB endpoint accessibility
- API functionality
- HPA configuration
- Pod health and readiness

### Step 2: Manual Validation Commands

```bash
# Check all resources in namespace
kubectl get all -n routeclouds-ns

# Verify deployments are ready
kubectl get deployments -n routeclouds-ns
kubectl describe deployment backend -n routeclouds-ns
kubectl describe deployment frontend -n routeclouds-ns

# Check pod status and logs
kubectl get pods -n routeclouds-ns
kubectl logs -n routeclouds-ns -l app=backend --tail=20
kubectl logs -n routeclouds-ns -l app=frontend --tail=20

# Verify services and endpoints
kubectl get svc -n routeclouds-ns
kubectl get endpoints -n routeclouds-ns

# Check ingress and ALB status
kubectl get ingress -n routeclouds-ns
kubectl describe ingress routeclouds-ingress -n routeclouds-ns
```

### Step 3: End-to-End Application Testing

```bash
# Get ALB DNS name
ALB_DNS=$(kubectl get ingress routeclouds-ingress -n routeclouds-ns -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Application URL: http://$ALB_DNS"

# Test frontend accessibility
echo "Testing Frontend..."
curl -s -o /dev/null -w "%{http_code}" http://$ALB_DNS/
# Expected: 200

# Test backend API health
echo "Testing Backend API..."
curl -s http://$ALB_DNS/api/health
# Expected: {"status": "healthy"}

# Test backend API with database
curl -s http://$ALB_DNS/api/status
# Expected: {"database": "connected", "status": "ok"}

# Test API endpoints
curl -s http://$ALB_DNS/api/users
# Expected: JSON response with users data
```

### Step 4: Monitoring and Logs Review

```bash
# Check application logs
echo "=== Backend Logs ==="
kubectl logs -n routeclouds-ns -l app=backend --tail=20

echo "=== Frontend Logs ==="
kubectl logs -n routeclouds-ns -l app=frontend --tail=20

# Check ALB controller logs
echo "=== ALB Controller Logs ==="
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=10

# Check for ALB controller errors
kubectl logs -n kube-system deployment/aws-load-balancer-controller | grep -i error || echo "No errors found in ALB controller logs"

# Monitor resource usage
kubectl top pods -n routeclouds-ns
kubectl top nodes

# Check pod events for issues
kubectl get events -n routeclouds-ns --sort-by='.lastTimestamp' --field-selector type=Warning

# Stream logs in real-time (for debugging)
echo "=== Real-time Log Monitoring Commands ==="
echo "Backend logs: kubectl logs -n routeclouds-ns -l app=backend -f"
echo "Frontend logs: kubectl logs -n routeclouds-ns -l app=frontend -f"
echo "ALB controller logs: kubectl logs -n kube-system deployment/aws-load-balancer-controller -f"
```

### Step 5: Load Testing (Optional)

```bash
# Install Apache Bench for load testing
sudo apt-get update && sudo apt-get install -y apache2-utils

# Test frontend performance
ab -n 1000 -c 10 http://$ALB_DNS/

# Test backend API performance
ab -n 1000 -c 10 http://$ALB_DNS/api/health

# Monitor HPA during load testing
kubectl get hpa -n routeclouds-ns -w

# Monitor pod scaling
kubectl get pods -n routeclouds-ns -l app=backend -w
```

---

## Cleanup Procedures (Phase 8)

### Step 1: Kubernetes Resources Cleanup

**⚠️ Important**: Delete resources in reverse order to avoid dependency issues.

```bash
# Navigate to k8s directory
cd k8s/

# Delete all Kubernetes resources in reverse order
echo "=== Deleting Kubernetes Resources ==="

# Delete ingress first (removes ALB)
kubectl delete -f ingress.yaml

# Wait for ALB deletion to complete
echo "Waiting for ALB deletion..."
sleep 30

# Delete application deployments
kubectl delete -f frontend.yaml
kubectl delete -f backend.yaml

# Delete supporting resources
kubectl delete -f migration_job.yaml
kubectl delete -f database-service.yaml
kubectl delete -f hpa.yaml

# Delete configuration
kubectl delete -f configmap.yaml
kubectl delete -f secrets.yaml

# Delete namespace (this will delete any remaining resources)
kubectl delete -f namespace.yaml

echo "✅ Kubernetes resources cleanup completed"
```

### Step 2: ALB Controller Cleanup

```bash
# Uninstall ALB controller
echo "=== Uninstalling ALB Controller ==="
helm uninstall aws-load-balancer-controller -n kube-system

# Delete ALB IAM policy
aws iam delete-policy --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy

# Delete service account
eksctl delete iamserviceaccount \
  --cluster=routeclouds-prod-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller

echo "✅ ALB Controller cleanup completed"
```

### Step 3: Infrastructure Cleanup with Terraform

```bash
# Navigate to infrastructure directory
cd ../infra/

# Destroy all infrastructure (takes 10-15 minutes)
echo "=== Destroying Infrastructure ==="
terraform destroy -auto-approve

# Verify cleanup
echo "=== Verifying Infrastructure Cleanup ==="
aws eks list-clusters --region us-east-1
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier,`routeclouds-prod-db`)]'

echo "✅ Infrastructure cleanup completed"
```

### Step 4: Manual Cleanup Verification

```bash
# Check for any remaining resources
echo "=== Checking for Remaining Resources ==="

# Check EKS clusters
echo "EKS Clusters:"
aws eks list-clusters --region us-east-1

# Check RDS instances
echo "RDS Instances:"
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[].DBInstanceIdentifier'

# Check VPCs (should only show default VPC)
echo "VPCs:"
aws ec2 describe-vpcs --region us-east-1 --query 'Vpcs[].{VpcId:VpcId,IsDefault:IsDefault,State:State}'

# Check Load Balancers
echo "Load Balancers:"
aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[].LoadBalancerName'

# Check NAT Gateways
echo "NAT Gateways:"
aws ec2 describe-nat-gateways --region us-east-1 --query 'NatGateways[?State!=`deleted`].{NatGatewayId:NatGatewayId,State:State}'

# Check Internet Gateways (excluding default VPC)
echo "Internet Gateways:"
aws ec2 describe-internet-gateways --region us-east-1 --query 'InternetGateways[?Attachments[0].VpcId!=`vpc-default`].{IGW:InternetGatewayId,VPC:Attachments[0].VpcId}'

echo "=== Cleanup verification complete ==="
```

### Step 5: Cost Verification

```bash
# Check for any running EC2 instances
echo "=== Cost Verification ==="
aws ec2 describe-instances --region us-east-1 --query 'Reservations[].Instances[?State.Name==`running`].{InstanceId:InstanceId,InstanceType:InstanceType,LaunchTime:LaunchTime}'

# Check for any EBS volumes
aws ec2 describe-volumes --region us-east-1 --query 'Volumes[?State==`available`].{VolumeId:VolumeId,Size:Size,VolumeType:VolumeType}'

# Check for any Elastic IPs
aws ec2 describe-addresses --region us-east-1 --query 'Addresses[].{PublicIp:PublicIp,AssociationId:AssociationId}'

echo "✅ Cost verification completed"
```

---

## Advanced Configuration (Phase 9)

### Step 1: Custom Domain Setup with Route53

#### Step 1.1: Create Route53 Hosted Zone

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

#### Step 1.2: Update Domain Nameservers

```bash
# Get the nameservers for your hosted zone
aws route53 get-hosted-zone --id $ZONE_ID --query "DelegationSet.NameServers"

# Update your domain registrar with these nameservers
echo "Update your domain registrar with the above nameservers"
```

#### Step 1.3: Create Alias Record for ALB

```bash
# Get the ALB DNS name from the Ingress
ALB_DNS=$(kubectl get ingress routeclouds-ingress -n routeclouds-ns -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "ALB DNS Name: $ALB_DNS"

# Get ALB Hosted Zone ID (us-east-1 specific)
ALB_ZONE_ID="Z32O12XQLNTSW2"

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
            "HostedZoneId": "'$ALB_ZONE_ID'",
            "DNSName": "'$ALB_DNS'",
            "EvaluateTargetHealth": true
          }
        }
      }
    ]
  }'
```

#### Step 1.4: Verify DNS Resolution

```bash
# Wait for DNS propagation (can take up to 48 hours, but usually much faster)
# Test DNS resolution
dig app.yourdomain.com

# Test application access
curl -I http://app.yourdomain.com
```

### Step 2: SSL/TLS Certificates with cert-manager

#### Step 2.1: Install cert-manager

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

# Verify cert-manager installation
kubectl get pods -n cert-manager
```

#### Step 2.2: Create ClusterIssuer for Let's Encrypt

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
    email: your-email@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: alb
EOF

# Apply ClusterIssuer
kubectl apply -f cluster-issuer.yaml
```

#### Step 2.3: Update Ingress with TLS

```bash
# Create TLS-enabled ingress
cat > ingress-with-tls.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: routeclouds-ingress-tls
  namespace: routeclouds-ns
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - app.yourdomain.com
    secretName: tls-secret
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

# Apply TLS ingress
kubectl apply -f ingress-with-tls.yaml

# Monitor certificate issuance
kubectl get certificates -n routeclouds-ns
kubectl describe certificate tls-secret -n routeclouds-ns
```

---

## Security Hardening (Phase 10)

### Step 1: Network Policies

#### Step 1.1: Create Default Deny Policy

```bash
# Create default deny network policy
cat > default-deny.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: routeclouds-ns
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
EOF

# Apply default deny policy
kubectl apply -f default-deny.yaml
```

#### Step 1.2: Create Application-Specific Policies

```bash
# Frontend network policy
cat > frontend-policy.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-policy
  namespace: routeclouds-ns
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
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

# Backend network policy
cat > backend-policy.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
  namespace: routeclouds-ns
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
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to: []
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
kubectl apply -f frontend-policy.yaml
kubectl apply -f backend-policy.yaml
```

### Step 2: Pod Security Standards

```bash
# Apply pod security standards to namespace
kubectl label namespace routeclouds-ns pod-security.kubernetes.io/enforce=restricted
kubectl label namespace routeclouds-ns pod-security.kubernetes.io/audit=restricted
kubectl label namespace routeclouds-ns pod-security.kubernetes.io/warn=restricted

# Verify labels
kubectl get namespace routeclouds-ns --show-labels
```

### Step 3: Security Context for Pods

```bash
# Update backend deployment with security context
kubectl patch deployment backend -n routeclouds-ns -p '{
  "spec": {
    "template": {
      "spec": {
        "securityContext": {
          "runAsNonRoot": true,
          "runAsUser": 1000,
          "runAsGroup": 3000,
          "fsGroup": 2000
        },
        "containers": [{
          "name": "backend",
          "securityContext": {
            "allowPrivilegeEscalation": false,
            "capabilities": {
              "drop": ["ALL"]
            },
            "readOnlyRootFilesystem": false,
            "runAsNonRoot": true
          }
        }]
      }
    }
  }
}'

# Update frontend deployment with security context
kubectl patch deployment frontend -n routeclouds-ns -p '{
  "spec": {
    "template": {
      "spec": {
        "securityContext": {
          "runAsNonRoot": true,
          "runAsUser": 1000,
          "runAsGroup": 3000,
          "fsGroup": 2000
        },
        "containers": [{
          "name": "frontend",
          "securityContext": {
            "allowPrivilegeEscalation": false,
            "capabilities": {
              "drop": ["ALL"]
            },
            "readOnlyRootFilesystem": false,
            "runAsNonRoot": true
          }
        }]
      }
    }
  }
}'
```

### Advanced: AWS Secrets Manager Integration with External Secrets Operator

#### Step 1: Store Secrets in AWS Secrets Manager

```bash
# Create secret in AWS Secrets Manager for RouteClouds
aws secretsmanager create-secret \
  --name routeclouds-prod/db-credentials \
  --description "Database credentials for RouteClouds production" \
  --secret-string '{"username":"postgres","password":"'$(openssl rand -base64 20)'","host":"routeclouds-prod-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com","port":"5432","dbname":"routeclouds_ecommerce_db"}'

# Get secret ARN
SECRET_ARN=$(aws secretsmanager describe-secret --secret-id routeclouds-prod/db-credentials --query ARN --output text)
echo "Secret ARN: $SECRET_ARN"

# Create additional secrets for application
aws secretsmanager create-secret \
  --name routeclouds-prod/app-secrets \
  --description "Application secrets for RouteClouds" \
  --secret-string '{"jwt_secret":"'$(openssl rand -base64 32)'","api_key":"'$(openssl rand -hex 16)'","encryption_key":"'$(openssl rand -base64 24)'"}'
```

#### Step 2: Install External Secrets Operator

```bash
# Add Helm repository
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

# Install External Secrets Operator
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --set installCRDs=true

# Verify installation
kubectl get pods -n external-secrets
kubectl get crd | grep external-secrets
```

#### Step 4.2: Create SecretStore for AWS Secrets Manager

```bash
# Create IAM role for External Secrets Operator
cat > external-secrets-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret"
            ],
            "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:db/routeclouds-prod-db*"
        }
    ]
}
EOF

# Create IAM policy
aws iam create-policy \
    --policy-name ExternalSecretsPolicy \
    --policy-document file://external-secrets-policy.json

# Create service account with IAM role
eksctl create iamserviceaccount \
  --cluster=routeclouds-prod-cluster \
  --namespace=routeclouds-ns \
  --name=external-secrets-sa \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/ExternalSecretsPolicy \
  --approve

# Create SecretStore
cat > secret-store.yaml << EOF
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: routeclouds-ns
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
EOF

kubectl apply -f secret-store.yaml

# Verify SecretStore
kubectl get secretstore -n routeclouds-ns
kubectl describe secretstore aws-secrets-manager -n routeclouds-ns
```

#### Step 5: Create ExternalSecret Resources

```bash
# Create ExternalSecret for database credentials
cat > external-secret-db.yaml << EOF
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials-external
  namespace: routeclouds-ns
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: db-secrets-external
    creationPolicy: Owner
  data:
  - secretKey: username
    remoteRef:
      key: routeclouds-prod/db-credentials
      property: username
  - secretKey: password
    remoteRef:
      key: routeclouds-prod/db-credentials
      property: password
  - secretKey: host
    remoteRef:
      key: routeclouds-prod/db-credentials
      property: host
  - secretKey: port
    remoteRef:
      key: routeclouds-prod/db-credentials
      property: port
  - secretKey: dbname
    remoteRef:
      key: routeclouds-prod/db-credentials
      property: dbname
EOF

kubectl apply -f external-secret-db.yaml

# Create ExternalSecret for application secrets
cat > external-secret-app.yaml << EOF
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets-external
  namespace: routeclouds-ns
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: app-secrets-external
    creationPolicy: Owner
  data:
  - secretKey: jwt_secret
    remoteRef:
      key: routeclouds-prod/app-secrets
      property: jwt_secret
  - secretKey: api_key
    remoteRef:
      key: routeclouds-prod/app-secrets
      property: api_key
  - secretKey: encryption_key
    remoteRef:
      key: routeclouds-prod/app-secrets
      property: encryption_key
EOF

kubectl apply -f external-secret-app.yaml
```

#### Step 6: Verify External Secrets Integration

```bash
# Check ExternalSecret status
kubectl get externalsecret -n routeclouds-ns
kubectl describe externalsecret db-credentials-external -n routeclouds-ns
kubectl describe externalsecret app-secrets-external -n routeclouds-ns

# Verify secrets were created
kubectl get secrets -n routeclouds-ns | grep external
kubectl describe secret db-secrets-external -n routeclouds-ns
kubectl describe secret app-secrets-external -n routeclouds-ns

# Test secret values (be careful with sensitive data)
echo "Database username:"
kubectl get secret db-secrets-external -n routeclouds-ns -o jsonpath='{.data.username}' | base64 -d
echo ""

echo "Database host:"
kubectl get secret db-secrets-external -n routeclouds-ns -o jsonpath='{.data.host}' | base64 -d
echo ""

# Check External Secrets Operator logs if issues occur
kubectl logs -n external-secrets deployment/external-secrets -f
```

#### Step 7: Update Application Deployments to Use External Secrets

```bash
# Update backend deployment to use external secrets
kubectl patch deployment backend -n routeclouds-ns -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "envFrom": [{
            "secretRef": {
              "name": "db-secrets-external"
            }
          }, {
            "secretRef": {
              "name": "app-secrets-external"
            }
          }]
        }]
      }
    }
  }
}'

# Verify deployment update
kubectl get deployment backend -n routeclouds-ns -o yaml | grep -A 10 envFrom
kubectl rollout status deployment/backend -n routeclouds-ns
```

---

## Production Readiness Checklist

### Infrastructure Checklist
- [ ] **Multi-AZ Deployment**: EKS nodes distributed across multiple AZs
- [ ] **RDS Multi-AZ**: Database configured for high availability
- [ ] **Backup Strategy**: Automated RDS backups configured
- [ ] **Monitoring**: CloudWatch metrics and alarms set up
- [ ] **Logging**: Centralized logging solution implemented
- [ ] **Security Groups**: Least privilege access configured
- [ ] **VPC Flow Logs**: Network traffic monitoring enabled

### Application Checklist
- [ ] **Health Checks**: Liveness and readiness probes configured
- [ ] **Resource Limits**: CPU and memory limits set for all containers
- [ ] **Horizontal Scaling**: HPA configured for auto-scaling
- [ ] **Rolling Updates**: Deployment strategy configured for zero-downtime
- [ ] **Configuration Management**: Secrets and ConfigMaps properly used
- [ ] **Image Security**: Container images scanned for vulnerabilities
- [ ] **Network Policies**: Micro-segmentation implemented

### Security Checklist
- [ ] **Pod Security Standards**: Restricted security context applied
- [ ] **RBAC**: Role-based access control configured
- [ ] **Network Policies**: Traffic segmentation implemented
- [ ] **Secrets Management**: External secrets operator configured
- [ ] **TLS/SSL**: HTTPS encryption enabled
- [ ] **Image Scanning**: Container vulnerability scanning enabled
- [ ] **Audit Logging**: Kubernetes audit logs enabled

### Operational Checklist
- [ ] **CI/CD Pipeline**: Automated deployment pipeline configured
- [ ] **Monitoring**: Prometheus and Grafana dashboards set up
- [ ] **Alerting**: Critical alerts configured and tested
- [ ] **Backup Testing**: Backup and restore procedures tested
- [ ] **Disaster Recovery**: DR plan documented and tested
- [ ] **Documentation**: Runbooks and troubleshooting guides created
- [ ] **Cost Optimization**: Resource usage monitored and optimized

---

## Troubleshooting Quick Reference

### Common Issues and Solutions

#### Issue 1: Pods Not Starting
```bash
# Check pod status and events
kubectl describe pod <pod-name> -n routeclouds-ns
kubectl get events -n routeclouds-ns --sort-by='.lastTimestamp'

# Common causes:
# - Image pull errors
# - Resource constraints
# - Configuration errors
# - Security context issues
```

#### Issue 2: ALB Not Creating
```bash
# Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller

# Verify subnet tags
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$(terraform output -raw vpc_id)" --query 'Subnets[].Tags'

# Check ingress annotations
kubectl describe ingress routeclouds-ingress -n routeclouds-ns
```

#### Issue 3: Database Connection Failures
```bash
# Run credential synchronization script
./update-db-secrets.sh

# Test database connectivity
kubectl run db-test --rm -it --image=postgres:13 -n routeclouds-ns -- bash
```

#### Issue 4: SSL Certificate Issues
```bash
# Check certificate status
kubectl get certificates -n routeclouds-ns
kubectl describe certificate tls-secret -n routeclouds-ns

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

---

## Performance Tuning

### Database Optimization
```bash
# RDS Performance Insights
aws rds modify-db-instance \
    --db-instance-identifier routeclouds-prod-db \
    --enable-performance-insights \
    --performance-insights-retention-period 7

# Connection pooling in application
# Update backend deployment with connection pool settings
kubectl patch deployment backend -n routeclouds-ns -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "env": [
            {"name": "DB_POOL_SIZE", "value": "10"},
            {"name": "DB_MAX_OVERFLOW", "value": "20"},
            {"name": "DB_POOL_TIMEOUT", "value": "30"}
          ]
        }]
      }
    }
  }
}'
```

### Application Optimization
```bash
# Optimize resource requests and limits
kubectl patch deployment backend -n routeclouds-ns -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "backend",
          "resources": {
            "requests": {"cpu": "200m", "memory": "256Mi"},
            "limits": {"cpu": "500m", "memory": "512Mi"}
          }
        }]
      }
    }
  }
}'

# Enable gzip compression in nginx (frontend)
kubectl create configmap nginx-config -n routeclouds-ns --from-literal=nginx.conf='
events {
    worker_connections 1024;
}
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    server {
        listen 80;
        location / {
            root /usr/share/nginx/html;
            index index.html index.htm;
            try_files $uri $uri/ /index.html;
        }
    }
}
'
```

---

## Final Deployment Summary

### Successfully Deployed Components:
- ✅ **Infrastructure**: EKS cluster, RDS PostgreSQL, VPC networking in us-east-1
- ✅ **Kubernetes**: Namespace, secrets, configmaps, services, deployments
- ✅ **Load Balancing**: AWS ALB with ingress controller
- ✅ **Monitoring**: HPA for auto-scaling, Prometheus/Grafana (optional)
- ✅ **CI/CD**: GitHub Actions with OIDC integration
- ✅ **Security**: Network policies, pod security standards, RBAC
- ✅ **SSL/TLS**: cert-manager with Let's Encrypt (optional)
- ✅ **External Secrets**: AWS Secrets Manager integration (optional)

### Deployment Phases Summary:

| Phase | Component | Duration | Key Actions |
|-------|-----------|----------|-------------|
| 1 | Infrastructure | 15-20 min | Terraform apply, EKS cluster creation |
| 2 | Kubernetes Setup | 5-10 min | kubectl config, ALB controller install |
| 3 | VPC Configuration | 3-5 min | Subnet tagging, security group verification |
| 4 | Application Deploy | 10-15 min | Manifest deployment in correct order |
| 5 | Ingress & ALB | 5-10 min | ALB creation and configuration |
| 6 | CI/CD Setup | 5-10 min | GitHub Actions configuration |
| 7 | Testing | 10-15 min | Comprehensive validation and debugging |
| 8 | Security Hardening | 5-10 min | Network policies, security contexts |
| 9 | Advanced Config | 10-20 min | Custom domain, SSL, external secrets |
| 10 | Cleanup | 10-15 min | Resource cleanup and verification |

### Critical Success Factors:
1. **Correct Manifest Order**: Namespace → Secrets → Services → Applications → Ingress
2. **Subnet Tagging**: CRITICAL - Public subnets must be tagged with `kubernetes.io/role/elb=1`
3. **ALB Controller**: Must be installed after subnet tagging and before ingress deployment
4. **Database Migration**: Must complete before application deployment
5. **Security Groups**: Proper configuration for RDS access (handled by Terraform)
6. **Database Connectivity**: Test DNS resolution and database connection before app deployment
7. **OIDC Provider**: Required for ALB controller service account authentication

### Quick Reference Commands:

#### Pod Cleanup Commands:
```bash
# Delete specific test pod
kubectl delete pod db-connectivity-test -n routeclouds-ns

# Force delete stuck pod
kubectl delete pod db-connectivity-test -n routeclouds-ns --force --grace-period=0

# List all pods in namespace
kubectl get pods -n routeclouds-ns

# Delete all failed/completed pods
kubectl delete pods --field-selector=status.phase=Failed -n routeclouds-ns
kubectl delete pods --field-selector=status.phase=Succeeded -n routeclouds-ns
```

#### Secret Management Commands:
```bash
# Check if secret exists
kubectl get secret db-secrets -n routeclouds-ns

# View secret details (without values)
kubectl describe secret db-secrets -n routeclouds-ns

# Delete and recreate secret
kubectl delete secret db-secrets -n routeclouds-ns
./update-db-secrets.sh
```

#### Database Connectivity Commands:
```bash
# Run database synchronization script
./update-db-secrets.sh

# Manual connectivity test
kubectl run db-test --rm -it --image=postgres:13 -n routeclouds-ns --restart=Never -- bash

# Inside the pod:
# PGPASSWORD='your-password' psql -h routeclouds-prod-db.xxx.us-east-1.rds.amazonaws.com -U routeclouds_user -d routeclouds_ecommerce_db
```

### Next Steps for Production:
- Configure custom domain with Route53
- Set up SSL/TLS certificates with cert-manager
- Implement comprehensive monitoring with Prometheus/Grafana
- Configure backup strategies for RDS
- Set up multi-environment deployments (dev/staging/prod)
- Implement centralized logging with ELK stack
- Configure security scanning and compliance monitoring
