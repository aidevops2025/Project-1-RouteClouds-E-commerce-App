# 3-Tier Application Core Concepts Guide

**Comprehensive Technical Concepts for DevOps Learning Platform**

---

## Table of Contents

### Foundational Concepts
1. [3-Tier Architecture Overview](#3-tier-architecture-overview)
2. [AWS EKS Core Concepts](#aws-eks-core-concepts)
3. [Terraform Infrastructure as Code](#terraform-infrastructure-as-code)
4. [Container and Kubernetes Fundamentals](#container-and-kubernetes-fundamentals)

### Networking and Security
5. [VPC and Subnet Architecture](#vpc-and-subnet-architecture)
6. [Security Groups Deep Dive](#security-groups-deep-dive)
7. [Load Balancer and Ingress Concepts](#load-balancer-and-ingress-concepts)
8. [DNS and Service Discovery](#dns-and-service-discovery)

### Authentication and Authorization
9. [IAM Roles and Service Accounts](#iam-roles-and-service-accounts)
10. [OIDC and IRSA Integration](#oidc-and-irsa-integration)
11. [Database Connectivity and Secrets Management](#database-connectivity-and-secrets-management)
12. [CI/CD Pipeline Integration](#cicd-pipeline-integration)

### Advanced Topics
13. [Monitoring and Observability](#monitoring-and-observability)
14. [Scaling and Performance](#scaling-and-performance)
15. [Security Best Practices](#security-best-practices)
16. [Cost Optimization](#cost-optimization)

---

## 3-Tier Architecture Overview

### What is 3-Tier Architecture?

A **3-tier architecture** is a software design pattern that separates an application into three logical and physical computing tiers:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION TIER                           │
│                         (Frontend)                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   React.js      │  │     nginx       │  │   Static Files  │    │
│  │   Components    │  │   Web Server    │  │   (HTML/CSS/JS) │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION TIER                            │
│                          (Backend)                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   Flask API     │  │  Business Logic │  │   REST APIs     │    │
│  │   Application   │  │   Processing    │  │   Endpoints     │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA TIER                                 │
│                         (Database)                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   PostgreSQL    │  │   Data Storage  │  │   Backup &      │    │
│  │   Database      │  │   Management    │  │   Recovery      │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Benefits of 3-Tier Architecture

1. **Separation of Concerns**: Each tier has a specific responsibility
2. **Scalability**: Each tier can be scaled independently
3. **Maintainability**: Changes in one tier don't affect others
4. **Security**: Network isolation between tiers
5. **Flexibility**: Technology stack can be changed per tier

### Implementation in Our Project

#### Tier 1: Presentation (Frontend)
- **Technology**: React.js with nginx
- **Container**: Frontend Docker container
- **Kubernetes**: Deployment with 2 replicas
- **Access**: Via Application Load Balancer (ALB)
- **Port**: 80 (HTTP)

#### Tier 2: Application (Backend)
- **Technology**: Python Flask REST API
- **Container**: Backend Docker container
- **Kubernetes**: Deployment with 2 replicas
- **Access**: Via ALB with path-based routing (`/api`)
- **Port**: 8000 (HTTP)

#### Tier 3: Data (Database)
- **Technology**: AWS RDS PostgreSQL
- **Access**: Via Kubernetes ExternalName service
- **Security**: Private subnet, security group restrictions
- **Port**: 5432 (PostgreSQL)

---

## AWS EKS Core Concepts

### What is Amazon EKS?

**Amazon Elastic Kubernetes Service (EKS)** is a managed Kubernetes service that makes it easy to run Kubernetes on AWS without needing to install and operate your own Kubernetes control plane.

### EKS Architecture Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AWS MANAGED                                 │
│                     (Control Plane)                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   API Server    │  │      etcd       │  │   Scheduler     │    │
│  │                 │  │   (Data Store)  │  │                 │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│  ┌─────────────────┐  ┌─────────────────┐                         │
│  │ Controller      │  │   Cloud         │                         │
│  │ Manager         │  │   Controller    │                         │
│  └─────────────────┘  └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CUSTOMER MANAGED                              │
│                      (Worker Nodes)                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   EC2 Instance  │  │   EC2 Instance  │  │   EC2 Instance  │    │
│  │   (Node 1)      │  │   (Node 2)      │  │   (Node 3)      │    │
│  │                 │  │                 │  │                 │    │
│  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │    │
│  │  │   Pod     │  │  │  │   Pod     │  │  │  │   Pod     │  │    │
│  │  │           │  │  │  │           │  │  │  │           │  │    │
│  │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Key EKS Components

#### 1. Control Plane (AWS Managed)
- **API Server**: Entry point for all REST commands
- **etcd**: Distributed key-value store for cluster data
- **Scheduler**: Assigns pods to nodes
- **Controller Manager**: Runs controller processes
- **Cloud Controller Manager**: AWS-specific controllers

#### 2. Worker Nodes (Customer Managed)
- **EC2 Instances**: Virtual machines running containerized applications
- **kubelet**: Node agent that communicates with control plane
- **kube-proxy**: Network proxy for service discovery
- **Container Runtime**: Docker or containerd for running containers

#### 3. EKS Add-ons
Essential components for cluster functionality:

```hcl
cluster_addons = {
  coredns = {
    most_recent = true
  }
  eks-pod-identity-agent = {
    most_recent = true
  }
  kube-proxy = {
    most_recent = true
  }
  vpc-cni = {
    most_recent = true
    before_compute = true  # Critical for networking
  }
}
```

**Add-on Explanations:**
- **CoreDNS**: DNS server for service discovery within cluster
- **VPC CNI**: Networking plugin for pod IP assignment
- **kube-proxy**: Service networking and load balancing
- **EKS Pod Identity Agent**: Secure access to AWS services

### EKS Networking Model

#### Pod Networking
- Each pod gets a unique IP address from VPC CIDR
- Pods can communicate directly without NAT
- VPC CNI assigns secondary IP addresses to EC2 instances

#### Service Networking
- Services provide stable endpoints for pods
- ClusterIP: Internal cluster communication
- NodePort: External access via node ports
- LoadBalancer: External access via cloud load balancer

---

## Terraform Infrastructure as Code

### What is Terraform?

**Terraform** is an Infrastructure as Code (IaC) tool that allows you to define and provision infrastructure using declarative configuration files.

### Terraform Core Concepts

#### 1. Providers
Plugins that interact with APIs of cloud providers:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
```

#### 2. Resources
Infrastructure components you want to create:

```hcl
resource "aws_eks_cluster" "this" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.cluster_version

  vpc_config {
    subnet_ids = var.subnet_ids
  }
}
```

#### 3. Data Sources
Read-only information from existing infrastructure:

```hcl
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
```

#### 4. Variables
Input parameters for configuration:

```hcl
variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "routeclouds-prod-cluster"
}
```

#### 5. Outputs
Values returned after resource creation:

```hcl
output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = aws_eks_cluster.this.endpoint
}
```

### Terraform Modules

#### What are Modules?
Reusable, self-contained packages of Terraform code:

```hcl
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.31"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
}
```

#### Types of Modules

**1. Local Modules**
```hcl
module "oidc" {
  source = "./modules/oidc"  # Local path
  
  role_name   = "GitHubActionsEKSDeployRole"
  policy_name = "GitHubActionsEKSPolicy"
}
```

**2. Public Registry Modules**
```hcl
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"  # Public registry
  version = "~> 5.0"
  
  name = "bootcamp-vpc"
  cidr = "10.0.0.0/16"
}
```

#### Benefits of Using Modules
1. **Reusability**: Write once, use multiple times
2. **Organization**: Logical grouping of resources
3. **Encapsulation**: Hide complexity behind simple interfaces
4. **Consistency**: Standardized resource creation
5. **Maintainability**: Easier to update and manage

### Terraform Workflow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  terraform init │───▶│ terraform plan  │───▶│ terraform apply │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Download        │    │ Create execution│    │ Execute plan    │
│ providers and   │    │ plan showing    │    │ and create      │
│ modules         │    │ changes         │    │ resources       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

1. **terraform init**: Initialize working directory
2. **terraform plan**: Preview changes to be made
3. **terraform apply**: Execute the plan and create resources
4. **terraform destroy**: Remove all managed resources

---

## Container and Kubernetes Fundamentals

### Container Concepts

#### What are Containers?
Containers are lightweight, portable, and self-sufficient units that package applications with their dependencies.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HOST OPERATING SYSTEM                       │
├─────────────────────────────────────────────────────────────────────┤
│                        CONTAINER RUNTIME                           │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┤
│   Container 1   │   Container 2   │   Container 3   │   Container 4   │
│                 │                 │                 │                 │
│ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐ │
│ │     App     │ │ │     App     │ │ │     App     │ │ │     App     │ │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │
│ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐ │
│ │ Dependencies│ │ │ Dependencies│ │ │ Dependencies│ │ │ Dependencies│ │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

#### Docker Concepts

**Dockerfile**: Instructions for building container images
```dockerfile
# Frontend Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Multi-stage Build Benefits**:
- Smaller production images
- Separation of build and runtime environments
- Security through minimal attack surface

### Kubernetes Core Concepts

#### Pods
The smallest deployable unit in Kubernetes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: backend-pod
  namespace: routeclouds-ns
spec:
  containers:
  - name: backend
    image: backend:latest
    ports:
    - containerPort: 8000
    env:
    - name: DB_HOST
      valueFrom:
        secretKeyRef:
          name: db-secrets
          key: DB_HOST
```

#### Deployments
Manage replica sets and rolling updates:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: routeclouds-ns
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: backend:latest
        ports:
        - containerPort: 8000
```

#### Services
Provide stable network endpoints:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: routeclouds-ns
spec:
  type: ClusterIP
  ports:
  - port: 8000
    targetPort: 8000
  selector:
    app: backend
```

#### ConfigMaps and Secrets
Manage configuration and sensitive data:

```yaml
# ConfigMap for non-sensitive data
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  environment: "development"
  log_level: "info"

---
# Secret for sensitive data
apiVersion: v1
kind: Secret
metadata:
  name: db-secrets
type: Opaque
data:
  DB_PASSWORD: <base64-encoded-password>
```

---

## VPC and Subnet Architecture

### VPC (Virtual Private Cloud) Concepts

A **VPC** is a virtual network dedicated to your AWS account, logically isolated from other virtual networks.

```
┌─────────────────────────────────────────────────────────────────────┐
│                            VPC (10.0.0.0/16)                       │
│                                                                     │
│  ┌─────────────────────────┐    ┌─────────────────────────┐        │
│  │    Availability Zone A  │    │    Availability Zone B  │        │
│  │                         │    │                         │        │
│  │  ┌─────────────────┐    │    │  ┌─────────────────┐    │        │
│  │  │ Public Subnet   │    │    │  │ Public Subnet   │    │        │
│  │  │ 10.0.1.0/24     │    │    │  │ 10.0.2.0/24     │    │        │
│  │  │                 │    │    │  │                 │    │        │
│  │  │ ┌─────────────┐ │    │    │  │ ┌─────────────┐ │    │        │
│  │  │ │     ALB     │ │    │    │  │ │     ALB     │ │    │        │
│  │  │ └─────────────┘ │    │    │  │ └─────────────┘ │    │        │
│  │  └─────────────────┘    │    │  └─────────────────┘    │        │
│  │                         │    │                         │        │
│  │  ┌─────────────────┐    │    │  ┌─────────────────┐    │        │
│  │  │ Private Subnet  │    │    │  │ Private Subnet  │    │        │
│  │  │ 10.0.3.0/24     │    │    │  │ 10.0.4.0/24     │    │        │
│  │  │                 │    │    │  │                 │    │        │
│  │  │ ┌─────────────┐ │    │    │  │ ┌─────────────┐ │    │        │
│  │  │ │ EKS Nodes   │ │    │    │  │ │ EKS Nodes   │ │    │        │
│  │  │ │    RDS      │ │    │    │  │ │    RDS      │ │    │        │
│  │  │ └─────────────┘ │    │    │  │ └─────────────┘ │    │        │
│  │  └─────────────────┘    │    │  └─────────────────┘    │        │
│  └─────────────────────────┘    └─────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### Subnet Types and Purposes

#### Public Subnets
- **Purpose**: Resources that need direct internet access
- **Route**: 0.0.0.0/0 → Internet Gateway
- **Use Cases**: Load balancers, NAT gateways, bastion hosts
- **Required Tags**: `kubernetes.io/role/elb=1`

#### Private Subnets
- **Purpose**: Resources that should not have direct internet access
- **Route**: 0.0.0.0/0 → NAT Gateway
- **Use Cases**: EKS worker nodes, RDS databases, application servers
- **Required Tags**: `kubernetes.io/role/internal-elb=1`

### Network Components

#### Internet Gateway (IGW)
- Provides internet access to public subnets
- Horizontally scaled, redundant, and highly available
- One per VPC

#### NAT Gateway
- Allows outbound internet access from private subnets
- Managed service with high availability
- Placed in public subnets

#### Route Tables
Define where network traffic is directed:

```
Public Route Table:
- 10.0.0.0/16 → Local (VPC traffic)
- 0.0.0.0/0   → Internet Gateway

Private Route Table:
- 10.0.0.0/16 → Local (VPC traffic)
- 0.0.0.0/0   → NAT Gateway
```

### Subnet Tagging for EKS

Critical tags for ALB functionality:

```bash
# Public subnets (for internet-facing load balancers)
aws ec2 create-tags --resources subnet-12345 --tags Key=kubernetes.io/role/elb,Value=1

# Private subnets (for internal load balancers)
aws ec2 create-tags --resources subnet-67890 --tags Key=kubernetes.io/role/internal-elb,Value=1

# Cluster association (recommended)
aws ec2 create-tags --resources subnet-12345 --tags Key=kubernetes.io/cluster/routeclouds-prod-cluster,Value=shared
```

---

## Security Groups Deep Dive

### Security Group Fundamentals

**Security Groups** act as virtual firewalls controlling inbound and outbound traffic at the instance level.

### Security Group Architecture in 3-Tier Application

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INTERNET                                     │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTP/HTTPS (80/443)
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ALB Security Group                               │
│  Inbound:  80, 443 from 0.0.0.0/0                                 │
│  Outbound: All traffic to EKS Node Security Group                  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Dynamic ports
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  EKS Node Security Group                           │
│  Inbound:  All traffic from ALB Security Group                     │
│           All traffic from same security group (node-to-node)      │
│           443, 10250 from Cluster Security Group                   │
│  Outbound: All traffic (internet access via NAT)                   │
│           5432 to RDS Security Group                               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ PostgreSQL (5432)
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   RDS Security Group                               │
│  Inbound:  5432 from EKS Node Security Group only                  │
│  Outbound: None required                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Security Groups Explained

#### 1. Cluster Security Group
**Purpose**: Controls communication with EKS control plane

```hcl
cluster_security_group_additional_rules = {
  ingress_nodes_443 = {
    description                = "Node groups to cluster API"
    protocol                   = "tcp"
    from_port                  = 443
    to_port                    = 443
    type                       = "ingress"
    source_node_security_group = true
  }
}
```

#### 2. Node Security Group
**Purpose**: Controls communication between worker nodes

**Key Rules**:
- **Inbound**: All traffic from other nodes (pod-to-pod communication)
- **Outbound**: All traffic for internet access and database connections

#### 3. RDS Security Group
**Purpose**: Restricts database access to authorized sources only

```hcl
resource "aws_security_group_rule" "rds_ingress" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.node.id
  security_group_id        = aws_security_group.rds.id
}
```

### Security Group Best Practices

1. **Principle of Least Privilege**: Only allow necessary traffic
2. **Use Security Group References**: Reference other security groups instead of IP ranges
3. **Separate Concerns**: Different security groups for different tiers
4. **Document Rules**: Clear descriptions for all rules
5. **Regular Audits**: Review and remove unnecessary rules

---

## Load Balancer and Ingress Concepts

### Application Load Balancer (ALB) Overview

**ALB** is a Layer 7 load balancer that routes HTTP/HTTPS traffic based on request content.

### ALB Architecture in 3-Tier Application

```
                                  ┌─────────────────┐
                                  │                 │
                                  │  Internet       │
                                  │                 │
                                  └────────┬────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Application Load Balancer                       │
│                                                                     │
│  ┌─────────────────┐              ┌─────────────────┐              │
│  │   Target Group  │              │   Target Group  │              │
│  │   (Frontend)    │              │   (Backend)     │              │
│  │                 │              │                 │              │
│  │   Path: /*      │              │   Path: /api/*  │              │
│  │   Port: 80      │              │   Port: 8000    │              │
│  └─────────────────┘              └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
           │                                    │
           ▼                                    ▼
┌─────────────────┐                  ┌─────────────────┐
│   Frontend      │                  │    Backend      │
│   Pods          │                  │    Pods         │
│   (React/nginx) │                  │   (Flask API)   │
└─────────────────┘                  └─────────────────┘
```

### Kubernetes Ingress Concepts

#### What is Ingress?
An API object that manages external access to services in a cluster, typically HTTP.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: routeclouds-ingress
  namespace: routeclouds-ns
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /
spec:
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

#### Ingress Controller
A controller that watches Ingress resources and configures load balancers accordingly.

**AWS Load Balancer Controller**:
- Manages ALBs and NLBs for Kubernetes
- Provisions AWS load balancers based on Ingress resources
- Handles target group management and health checks

### Path-Based Routing

Routes traffic based on URL paths:

```
Request: https://app.example.com/api/users
├── Path: /api → Backend Service (Port 8000)
└── Response: JSON data from Flask API

Request: https://app.example.com/
├── Path: / → Frontend Service (Port 80)
└── Response: React application HTML
```

### Health Checks

ALB performs health checks on targets:

```yaml
annotations:
  alb.ingress.kubernetes.io/healthcheck-path: /health
  alb.ingress.kubernetes.io/healthcheck-interval-seconds: '30'
  alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
  alb.ingress.kubernetes.io/healthy-threshold-count: '2'
  alb.ingress.kubernetes.io/unhealthy-threshold-count: '3'
```

---

## DNS and Service Discovery

### Kubernetes DNS

#### CoreDNS
Default DNS server for Kubernetes clusters:

```yaml
# DNS resolution within cluster
frontend-pod → backend.routeclouds-ns.svc.cluster.local → backend-pod-ip
```

#### Service Discovery Patterns

**1. Service Names**
```bash
# Within same namespace
curl http://backend:8000/api/health

# Cross-namespace
curl http://backend.routeclouds-ns.svc.cluster.local:8000/api/health
```

**2. Environment Variables**
Kubernetes automatically creates environment variables for services:
```bash
BACKEND_SERVICE_HOST=10.100.200.1
BACKEND_SERVICE_PORT=8000
```

### ExternalName Service

Used to connect to external services (like RDS):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-db
  namespace: routeclouds-ns
spec:
  type: ExternalName
  externalName: routeclouds-prod-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com
  ports:
  - port: 5432
```

**How it works**:
```
Pod → postgres-db.routeclouds-ns.svc.cluster.local → CNAME → RDS endpoint
```

---

## IAM Roles and Service Accounts

### IAM (Identity and Access Management) Concepts

#### IAM Components

**1. IAM Policy**
JSON document defining permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeVpcs",
        "elasticloadbalancing:CreateLoadBalancer"
      ],
      "Resource": "*"
    }
  ]
}
```

**2. IAM Role**
An identity with permission policies that can be assumed:

```hcl
resource "aws_iam_role" "alb_controller" {
  name = "AmazonEKSLoadBalancerControllerRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub": "system:serviceaccount:kube-system:aws-load-balancer-controller"
          }
        }
      }
    ]
  })
}
```

**3. Service Account**
Kubernetes identity for workloads:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aws-load-balancer-controller
  namespace: kube-system
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/AmazonEKSLoadBalancerControllerRole
```

### IRSA (IAM Roles for Service Accounts)

#### How IRSA Works

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Kubernetes    │    │      OIDC       │    │      AWS        │
│   Service       │───▶│   Identity      │───▶│      STS        │
│   Account       │    │   Provider      │    │                 │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ JWT Token       │    │ Token Exchange  │    │ Temporary AWS   │
│ (Kubernetes)    │    │ and Validation  │    │ Credentials     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### IRSA Benefits

1. **No Long-term Credentials**: Uses temporary tokens
2. **Fine-grained Permissions**: Specific roles for specific workloads
3. **Automatic Rotation**: Tokens are automatically rotated
4. **Audit Trail**: All actions logged in CloudTrail
5. **Secure**: No secrets stored in containers

---

## OIDC and IRSA Integration

### OpenID Connect (OIDC) Provider

#### What is OIDC?
An identity layer on top of OAuth 2.0 that allows verification of user identity.

#### EKS OIDC Provider Setup

```hcl
# Get OIDC issuer URL from EKS cluster
data "aws_eks_cluster" "cluster" {
  name = var.cluster_name
}

# Create OIDC identity provider
resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["9e99a48a9960b14926bb7f3b02e22da2b0ab7280"]
  url             = data.aws_eks_cluster.cluster.identity[0].oidc[0].issuer
}
```

#### Trust Relationship

The trust policy allows the service account to assume the IAM role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B716D3041E"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.us-east-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B716D3041E:sub": "system:serviceaccount:kube-system:aws-load-balancer-controller",
          "oidc.eks.us-east-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B716D3041E:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
```

### GitHub Actions OIDC Integration

#### CI/CD with OIDC

```yaml
# GitHub Actions workflow
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ secrets.OIDC_ROLE_ARN }}
        aws-region: us-east-1
```

#### Benefits of OIDC for CI/CD

1. **No Long-term Secrets**: No AWS access keys in GitHub
2. **Automatic Rotation**: Tokens are short-lived
3. **Fine-grained Access**: Specific permissions per repository
4. **Audit Trail**: All actions logged and traceable
5. **Security**: Reduced risk of credential exposure

---

## Database Connectivity and Secrets Management

### Database Connectivity Architecture

#### ExternalName Service Pattern

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│ Application Pod │───▶│ ExternalName    │───▶│   AWS RDS       │
│                 │    │ Service         │    │   PostgreSQL    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ postgres-db.    │    │ DNS CNAME       │    │ routeclouds-prod-db │
│ routeclouds-ns. │    │ Resolution      │    │ .c6t4q0g6i4n5.  │
│ svc.cluster.    │    │                 │    │ us-east-1.rds.  │
│ local:5432      │    │                 │    │ amazonaws.com   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### Benefits of ExternalName Service

1. **Abstraction**: Applications use consistent internal names
2. **Flexibility**: Can change database endpoints without updating applications
3. **Environment Agnostic**: Same application code works across environments
4. **Service Discovery**: Leverages Kubernetes DNS resolution
5. **Portability**: Easy to switch between different database providers

### Secrets Management Strategy

#### The Challenge: Dynamic Credentials

**Problem Scenario**:
```bash
# Day 1: Deploy infrastructure
terraform apply
# RDS creates password: abc123

# Day 5: Recreate infrastructure
terraform destroy && terraform apply
# RDS creates NEW password: xyz789
# But Kubernetes still has: abc123
# Result: Authentication failures!
```

#### Solution: AWS Secrets Manager Integration

**AWS Secrets Manager** serves as the **single source of truth** for database credentials:

1. **Credential Storage**: AWS Secrets Manager stores the authoritative database connection string
2. **Dynamic Retrieval**: Scripts retrieve current credentials programmatically
3. **Kubernetes Sync**: Credentials are synchronized to Kubernetes secrets
4. **Application Access**: Pods use Kubernetes secrets for database connections

#### Architecture Flow

```
AWS RDS (generates password)
    ↓
AWS Secrets Manager (stores connection string)
    ↓
Sync Script (retrieves and parses)
    ↓
Kubernetes Secret (base64 encoded)
    ↓
Application Pods (environment variables)
    ↓
Database Connection (successful authentication)
```

### Credential Synchronization Process

#### Automated Synchronization Script

```bash
#!/bin/bash
# update-db-secrets.sh

# 1. Retrieve credentials from AWS Secrets Manager
SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id db/routeclouds-prod-db \
    --region us-east-1 \
    --query SecretString \
    --output text)

# 2. Parse PostgreSQL connection string components
DB_USER=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$SECRET_VALUE" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_NAME=$(echo "$SECRET_VALUE" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# 3. Base64 encode values for Kubernetes
DB_PASSWORD_B64=$(echo -n "$DB_PASSWORD" | base64 -w 0)
# ... encode other values

# 4. Update Kubernetes secret
kubectl patch secret db-secrets -n routeclouds-ns --type='merge' -p="{
  \"data\": {
    \"DB_PASSWORD\": \"$DB_PASSWORD_B64\"
  }
}"

# 5. Test connectivity
kubectl run db-test --rm -it --image=postgres:13 -n routeclouds-ns -- \
  psql -h postgres-db.routeclouds-ns.svc.cluster.local -U "$DB_USER" -d "$DB_NAME"
```

### External Secrets Operator (Advanced)

#### Alternative Approach

```yaml
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

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: routeclouds-ns
spec:
  refreshInterval: 15s
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: db-secrets
    creationPolicy: Owner
  data:
  - secretKey: DB_PASSWORD
    remoteRef:
      key: db/routeclouds-prod-db
      property: password
```

---

## CI/CD Pipeline Integration

### GitHub Actions with EKS

#### Workflow Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   GitHub        │───▶│   GitHub        │───▶│      AWS        │
│   Repository    │    │   Actions       │    │      EKS        │
│                 │    │   Runner        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Code Changes    │    │ Build & Test    │    │ Deploy to       │
│ (Push/PR)       │    │ Docker Images   │    │ Kubernetes      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### Complete CI/CD Workflow

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ secrets.OIDC_ROLE_ARN }}
        aws-region: us-east-1

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v2

    - name: Build and push backend image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: backend
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG ./backend
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --name ${{ secrets.EKS_CLUSTER_NAME }} --region us-east-1

    - name: Deploy to EKS
      run: |
        kubectl set image deployment/backend backend=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -n ${{ secrets.KUBE_NAMESPACE }}
        kubectl rollout status deployment/backend -n ${{ secrets.KUBE_NAMESPACE }}
```

### ECR (Elastic Container Registry) Integration

#### Image Management Strategy

```bash
# Image tagging strategy
latest                    # Latest stable version
v1.2.3                   # Semantic versioning
sha-abc123def            # Git commit SHA
feature-new-api          # Feature branch
```

#### Lifecycle Policies

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "tagged",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

---

## Monitoring and Observability

### Monitoring Stack Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MONITORING STACK                            │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   Prometheus    │  │     Grafana     │  │   AlertManager  │    │
│  │   (Metrics)     │  │  (Dashboards)   │  │ (Notifications) │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│           │                     │                     │            │
│           ▼                     ▼                     ▼            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Metric Storage  │  │ Visualization   │  │ Alert Rules     │    │
│  │ Time Series DB  │  │ Query Interface │  │ Routing         │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION METRICS                           │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   Frontend      │  │    Backend      │  │   Database      │    │
│  │   Metrics       │  │    Metrics      │  │   Metrics       │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Metrics to Monitor

#### Infrastructure Metrics
- **CPU Utilization**: Node and pod CPU usage
- **Memory Usage**: Available memory and memory pressure
- **Network I/O**: Bandwidth utilization and packet loss
- **Disk I/O**: Read/write operations and disk space

#### Application Metrics
- **Request Rate**: Requests per second
- **Response Time**: Average and percentile response times
- **Error Rate**: 4xx and 5xx error percentages
- **Throughput**: Successful transactions per second

#### Database Metrics
- **Connection Count**: Active database connections
- **Query Performance**: Slow query identification
- **Lock Waits**: Database lock contention
- **Replication Lag**: For multi-AZ deployments

---

## Scaling and Performance

### Horizontal Pod Autoscaler (HPA)

#### HPA Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: routeclouds-ns
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
```

#### Scaling Behavior

```
Load Increase → CPU > 70% → Scale Up → More Pods → Distribute Load
Load Decrease → CPU < 70% → Scale Down → Fewer Pods → Cost Optimization
```

### Cluster Autoscaler

#### Node-Level Scaling

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  template:
    spec:
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.21.0
        name: cluster-autoscaler
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/routeclouds-prod-cluster
```

#### Scaling Flow

```
Pod Pending → No Available Resources → Trigger Scale-Up → Add EC2 Instance → Schedule Pod
Low Utilization → Underutilized Nodes → Trigger Scale-Down → Remove EC2 Instance → Cost Savings
```

### Performance Optimization Strategies

#### Resource Right-sizing

```yaml
# Before optimization
resources:
  requests:
    cpu: 1000m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 2Gi

# After optimization (based on monitoring)
resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

#### Database Connection Pooling

```python
# Backend application configuration
import sqlalchemy
from sqlalchemy.pool import QueuePool

engine = sqlalchemy.create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=3600
)
```

---

## Security Best Practices

### Defense in Depth Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PERIMETER SECURITY                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │      WAF        │  │   CloudFront    │  │   Route53       │    │
│  │   (Web App      │  │   (CDN)         │  │   (DNS)         │    │
│  │   Firewall)     │  │                 │  │                 │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NETWORK SECURITY                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Security Groups │  │ Network ACLs    │  │ VPC Flow Logs   │    │
│  │                 │  │                 │  │                 │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    APPLICATION SECURITY                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Network Policies│  │ Pod Security    │  │ RBAC            │    │
│  │                 │  │ Standards       │  │                 │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Pod Security Standards

#### Restricted Security Context

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
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
          runAsNonRoot: true
```

### Network Policies

#### Micro-segmentation

```yaml
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
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 5432  # Database access only
```

### RBAC (Role-Based Access Control)

#### Service Account Permissions

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: routeclouds-ns
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "watch", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: routeclouds-ns
subjects:
- kind: ServiceAccount
  name: backend-sa
  namespace: routeclouds-ns
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

---

## Cost Optimization

### Resource Optimization Strategies

#### Right-sizing Instances

```bash
# Monitor resource usage
kubectl top pods -n routeclouds-ns
kubectl top nodes

# Analyze usage patterns
kubectl describe node <node-name> | grep -A 5 "Allocated resources"
```

#### Spot Instances for Non-Critical Workloads

```hcl
# EKS managed node group with spot instances
managed_node_groups = {
  spot = {
    capacity_type  = "SPOT"
    instance_types = ["t3.medium", "t3.large"]

    min_size     = 0
    max_size     = 10
    desired_size = 2

    k8s_labels = {
      Environment = "dev"
      NodeType    = "spot"
    }

    taints = {
      spot = {
        key    = "spot-instance"
        value  = "true"
        effect = "NO_SCHEDULE"
      }
    }
  }
}
```

### Cost Monitoring and Alerts

#### Key Cost Metrics
- **EC2 Instance Hours**: Node group utilization
- **EBS Storage**: Persistent volume costs
- **Data Transfer**: Cross-AZ and internet traffic
- **Load Balancer Hours**: ALB/NLB usage
- **RDS Instance Hours**: Database utilization

#### Cost Allocation Tags

```hcl
# Consistent tagging strategy
common_tags = {
  Environment = "dev"
  Project     = "3-tier-app"
  Owner       = "devops-team"
  CostCenter  = "engineering"
  Application = "learning-platform"
}
```

### Automated Cost Optimization

#### Scheduled Scaling

```yaml
# Scale down during off-hours
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scale-down-workloads
spec:
  schedule: "0 18 * * 1-5"  # 6 PM weekdays
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: kubectl
            image: bitnami/kubectl
            command:
            - /bin/sh
            - -c
            - |
              kubectl scale deployment frontend --replicas=1 -n routeclouds-ns
              kubectl scale deployment backend --replicas=1 -n routeclouds-ns
```

---

## Summary and Best Practices

### Architecture Principles

1. **Separation of Concerns**: Each tier has specific responsibilities
2. **Scalability**: Independent scaling of each component
3. **Security**: Defense in depth with multiple security layers
4. **Observability**: Comprehensive monitoring and logging
5. **Automation**: Infrastructure as Code and CI/CD pipelines

### Key Takeaways

#### Infrastructure
- Use managed services (EKS, RDS) to reduce operational overhead
- Implement proper VPC design with public/private subnets
- Apply security groups with least privilege principles
- Tag resources consistently for cost allocation and management

#### Application
- Containerize applications for portability and consistency
- Use Kubernetes best practices for deployments and services
- Implement health checks and resource limits
- Design for horizontal scaling with stateless applications

#### Security
- Apply pod security standards and network policies
- Use IRSA for secure AWS service access
- Implement RBAC for fine-grained access control
- Regularly update and patch all components

#### Operations
- Monitor all layers of the application stack
- Implement automated scaling based on metrics
- Use GitOps for deployment automation
- Plan for disaster recovery and backup strategies

### Future Enhancements

1. **Service Mesh**: Implement Istio for advanced traffic management
2. **GitOps**: Use ArgoCD for declarative deployments
3. **Observability**: Add distributed tracing with Jaeger
4. **Security**: Implement policy engines like OPA Gatekeeper
5. **Multi-Region**: Expand to multiple AWS regions for DR

This comprehensive core concepts guide provides the foundational knowledge needed to understand, deploy, and operate a production-ready 3-tier application on AWS EKS.

---

## Database Connectivity and Secrets Management

### Database Connectivity Architecture

#### ExternalName Service Pattern

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│ Application Pod │───▶│ ExternalName    │───▶│   AWS RDS       │
│                 │    │ Service         │    │   PostgreSQL    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ postgres-db.    │    │ DNS CNAME       │    │ routeclouds-prod-db │
│ routeclouds-ns. │    │ Resolution      │    │ .c6t4q0g6i4n5.  │
│ svc.cluster.    │    │                 │    │ us-east-1.rds.  │
│ local:5432      │    │                 │    │ amazonaws.com   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### Benefits of ExternalName Service

1. **Abstraction**: Applications use consistent internal names
2. **Flexibility**: Can change database endpoints without updating applications
3. **Environment Agnostic**: Same application code works across environments
4. **Service Discovery**: Leverages Kubernetes DNS resolution
5. **Portability**: Easy to switch between different database providers

### Secrets Management Strategy

#### The Challenge: Dynamic Credentials

**Problem Scenario**:
```bash
# Day 1: Deploy infrastructure
terraform apply
# RDS creates password: abc123

# Day 5: Recreate infrastructure
terraform destroy && terraform apply
# RDS creates NEW password: xyz789
# But Kubernetes still has: abc123
# Result: Authentication failures!
```

#### Solution: AWS Secrets Manager Integration

**AWS Secrets Manager** serves as the **single source of truth** for database credentials:

1. **Credential Storage**: AWS Secrets Manager stores the authoritative database connection string
2. **Dynamic Retrieval**: Scripts retrieve current credentials programmatically
3. **Kubernetes Sync**: Credentials are synchronized to Kubernetes secrets
4. **Application Access**: Pods use Kubernetes secrets for database connections

#### Architecture Flow

```
AWS RDS (generates password)
    ↓
AWS Secrets Manager (stores connection string)
    ↓
Sync Script (retrieves and parses)
    ↓
Kubernetes Secret (base64 encoded)
    ↓
Application Pods (environment variables)
    ↓
Database Connection (successful authentication)
```

### Credential Synchronization Process

#### Automated Synchronization Script

```bash
#!/bin/bash
# update-db-secrets.sh

# 1. Retrieve credentials from AWS Secrets Manager
SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id db/routeclouds-prod-db \
    --region us-east-1 \
    --query SecretString \
    --output text)

# 2. Parse PostgreSQL connection string components
DB_USER=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$SECRET_VALUE" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_NAME=$(echo "$SECRET_VALUE" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# 3. Base64 encode values for Kubernetes
DB_PASSWORD_B64=$(echo -n "$DB_PASSWORD" | base64 -w 0)
# ... encode other values

# 4. Update Kubernetes secret
kubectl patch secret db-secrets -n routeclouds-ns --type='merge' -p="{
  \"data\": {
    \"DB_PASSWORD\": \"$DB_PASSWORD_B64\"
  }
}"

# 5. Test connectivity
kubectl run db-test --rm -it --image=postgres:13 -n routeclouds-ns -- \
  psql -h postgres-db.routeclouds-ns.svc.cluster.local -U "$DB_USER" -d "$DB_NAME"
```

### External Secrets Operator (Advanced)

#### Alternative Approach

```yaml
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

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: routeclouds-ns
spec:
  refreshInterval: 15s
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: db-secrets
    creationPolicy: Owner
  data:
  - secretKey: DB_PASSWORD
    remoteRef:
      key: db/routeclouds-prod-db
      property: password
```

---

## CI/CD Pipeline Integration

### GitHub Actions with EKS

#### Workflow Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   GitHub        │───▶│   GitHub        │───▶│      AWS        │
│   Repository    │    │   Actions       │    │      EKS        │
│                 │    │   Runner        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Code Changes    │    │ Build & Test    │    │ Deploy to       │
│ (Push/PR)       │    │ Docker Images   │    │ Kubernetes      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

#### Complete CI/CD Workflow

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ secrets.OIDC_ROLE_ARN }}
        aws-region: us-east-1

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v2

    - name: Build and push backend image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: backend
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG ./backend
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --name ${{ secrets.EKS_CLUSTER_NAME }} --region us-east-1

    - name: Deploy to EKS
      run: |
        kubectl set image deployment/backend backend=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -n ${{ secrets.KUBE_NAMESPACE }}
        kubectl rollout status deployment/backend -n ${{ secrets.KUBE_NAMESPACE }}
```

### ECR (Elastic Container Registry) Integration

#### Image Management Strategy

```bash
# Image tagging strategy
latest                    # Latest stable version
v1.2.3                   # Semantic versioning
sha-abc123def            # Git commit SHA
feature-new-api          # Feature branch
```

#### Lifecycle Policies

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "tagged",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

---

## Monitoring and Observability

### Monitoring Stack Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MONITORING STACK                            │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   Prometheus    │  │     Grafana     │  │   AlertManager  │    │
│  │   (Metrics)     │  │  (Dashboards)   │  │ (Notifications) │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│           │                     │                     │            │
│           ▼                     ▼                     ▼            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Metric Storage  │  │ Visualization   │  │ Alert Rules     │    │
│  │ Time Series DB  │  │ Query Interface │  │ Routing         │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION METRICS                           │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │   Frontend      │  │    Backend      │  │   Database      │    │
│  │   Metrics       │  │    Metrics      │  │   Metrics       │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Metrics to Monitor

#### Infrastructure Metrics
- **CPU Utilization**: Node and pod CPU usage
- **Memory Usage**: Available memory and memory pressure
- **Network I/O**: Bandwidth utilization and packet loss
- **Disk I/O**: Read/write operations and disk space

#### Application Metrics
- **Request Rate**: Requests per second
- **Response Time**: Average and percentile response times
- **Error Rate**: 4xx and 5xx error percentages
- **Throughput**: Successful transactions per second

#### Database Metrics
- **Connection Count**: Active database connections
- **Query Performance**: Slow query identification
- **Lock Waits**: Database lock contention
- **Replication Lag**: For multi-AZ deployments

### Horizontal Pod Autoscaler (HPA)

#### HPA Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: routeclouds-ns
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
```

#### Scaling Behavior

```
Load Increase → CPU > 70% → Scale Up → More Pods → Distribute Load
Load Decrease → CPU < 70% → Scale Down → Fewer Pods → Cost Optimization
```

---

## Security Best Practices

### Defense in Depth Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PERIMETER SECURITY                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │      WAF        │  │   CloudFront    │  │   Route53       │    │
│  │   (Web App      │  │   (CDN)         │  │   (DNS)         │    │
│  │   Firewall)     │  │                 │  │                 │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NETWORK SECURITY                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Security Groups │  │ Network ACLs    │  │ VPC Flow Logs   │    │
│  │                 │  │                 │  │                 │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    APPLICATION SECURITY                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Network Policies│  │ Pod Security    │  │ RBAC            │    │
│  │                 │  │ Standards       │  │                 │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Pod Security Standards

#### Restricted Security Context

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
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
          runAsNonRoot: true
```

### Network Policies

#### Micro-segmentation

```yaml
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
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 5432  # Database access only
```

---

## Cost Optimization

### Resource Right-sizing

#### CPU and Memory Optimization

```yaml
# Before optimization
resources:
  requests:
    cpu: 1000m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 2Gi

# After optimization (based on monitoring)
resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### Auto Scaling Strategies

#### Cluster Autoscaler

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  template:
    spec:
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.21.0
        name: cluster-autoscaler
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/routeclouds-prod-cluster
```

### Cost Monitoring

#### Key Cost Metrics
- **EC2 Instance Hours**: Node group utilization
- **EBS Storage**: Persistent volume costs
- **Data Transfer**: Cross-AZ and internet traffic
- **Load Balancer Hours**: ALB/NLB usage
- **RDS Instance Hours**: Database utilization

This comprehensive core concepts guide provides deep technical understanding of all components in the 3-tier EKS application, from basic architecture to advanced security and optimization strategies.
