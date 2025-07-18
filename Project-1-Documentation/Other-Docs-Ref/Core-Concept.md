
# 3-Tier Application Core Concepts Guide

## Table of Contents

### 1. [AWS Load Balancer Controller Concepts](#aws-load-balancer-controller-concepts)
   - IAM Policy and Role Management
   - Service Account Integration
   - IRSA (IAM Roles for Service Accounts)
   - Trust Relationships and OIDC

### 2. [Database Connectivity and Credential Management](#database-connectivity-and-credential-management)
   - ExternalName Service Pattern
   - AWS Secrets Manager Integration
   - Kubernetes Secret Synchronization
   - Database Connectivity Testing Strategy
   - Credential Lifecycle Management

### 3. [EKS Networking and Service Discovery](#eks-networking-and-service-discovery)
   - DNS Resolution in Kubernetes
   - Service Types and Their Use Cases
   - Cross-Service Communication

### 4. [Security and Access Management](#security-and-access-management)
   - Pod Security Context
   - Secret Management Best Practices
   - Network Security Policies

---

## AWS Load Balancer Controller Concepts

### Core-1: Install AWS Load Balancer Controller
```bash
# Navigate to k8s directory
cd k8s/

# Create IAM policy for ALB controller
aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam-policy.json

# Create service account for ALB controller
eksctl create iamserviceaccount \
  --cluster=bootcamp-dev-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

Core Concepts Explained for AWS Load Balancer 
1. **IAM Policy**:
   - What it is: A JSON document defining permissions (what actions are allowed/denied on which AWS resources)
   - Example: Like a security badge that says "Can open doors 1-5, but not access the server room"
   - Purpose: Defines what the Load Balancer Controller can do in AWS

2. **IAM Role**:
   - What it is: An identity with permission policies that can be assumed by AWS services
   - Example: Like a company uniform worn by different employees to gain specific access
   - Purpose: Acts as a container for permissions that can be temporarily assumed

3. **Service Account**:
   - What it is: A Kubernetes identity for workloads (pods) with attached permissions
   - Example: Like an employee ID card within your office building
   - Purpose: Grants Kubernetes applications access to external resources

4. **IRSA (IAM Roles for Service Accounts)**:
   - What it is: Mechanism linking Kubernetes Service Accounts to AWS IAM Roles
   - How it works: Uses OIDC identity provider to exchange Kubernetes tokens for AWS temporary credentials
   - Purpose: Secure, short-term credential management without long-term secrets

---

### Step 2: Creating IAM Policy - Deep Dive
```bash
aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam-policy.json
```

**What's happening:**
1. Reads permissions from `iam-policy.json` (typically the [official AWS policy](https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json))
2. Creates an IAM policy defining permissions like:
   - Create/modify/delete load balancers
   - Access EC2 instances and security groups
   - Modify VPC networking components
   - Read cluster information

**Example Policy Snippet:**
```json
{
    "Action": [
        "ec2:DescribeVpcs",
        "elasticloadbalancing:CreateLoadBalancer",
        "elasticloadbalancing:DeleteLoadBalancer"
    ],
    "Resource": "*",
    "Effect": "Allow"
}
```
*Translation: "Allow the controller to view VPCs and create/delete load balancers"*

**Why needed:**  
The controller needs these permissions to automatically provision and manage AWS Load Balancers when you create Kubernetes Services or Ingress resources.

---

### Step 3: Creating IAM Service Account - Deep Dive
```bash
eksctl create iamserviceaccount \
  --cluster=bootcamp-dev-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
  --approve
```

**What's happening step-by-step:**

1. **Creates an IAM Role:**
   - Named `AmazonEKSLoadBalancerControllerRole`
   - Configures it to be assumable by EKS pods via OIDC federation

2. **Attaches the Policy:**
   - Links the policy created in Step 2 to the new role
   - The `$(aws sts...)` part dynamically inserts your AWS account ID

3. **Creates Kubernetes Service Account:**
   - In `kube-system` namespace
   - Named `aws-load-balancer-controller`
   - Adds special annotation with the IAM Role ARN:
     ```yaml
     eks.amazonaws.com/role-arn: arn:aws:iam::1234567890:role/AmazonEKSLoadBalancerControllerRole
     ```

4. **Sets Up Trust Relationship:**
   Automatically configures the role's trust policy to allow:
   ```json
   {
     "Principal": {
       "Federated": "arn:aws:iam::1234567890:oidc-provider/oidc.eks.region.amazonaws.com/id/EXAMPLECLUSTERID"
     },
     "Condition": {
       "StringEquals": {
         "oidc.eks.region.amazonaws.com/id/EXAMPLECLUSTERID:sub": "system:serviceaccount:kube-system:aws-load-balancer-controller"
       }
     }
   }
   ```
   *Translation: "Only allow Kubernetes pods using this specific service account to assume this role"*

---

## Database Connectivity and Credential Management

### Overview: Why Database Connectivity Testing is Critical

In a 3-tier application architecture, the **database layer** is the foundation that stores and manages all application data. Ensuring reliable connectivity between Kubernetes pods and the database is crucial for application functionality. This section explains the concepts, patterns, and strategies used in our project.

### Core Problem Statement

**Challenge**: How do we securely connect Kubernetes applications to an external AWS RDS PostgreSQL database while managing dynamic credentials?

**Complexity Factors**:
- Database credentials change when infrastructure is recreated
- Kubernetes pods need consistent access to database services
- Security requires avoiding hardcoded credentials
- Multiple environments may have different database endpoints

### Architectural Pattern: ExternalName Service

#### What is an ExternalName Service?

An **ExternalName Service** is a Kubernetes service type that provides a way to reference external services (outside the cluster) using Kubernetes' native DNS resolution.

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

#### How ExternalName Service Works

1. **DNS Abstraction**:
   - Pods connect to `postgres-db.3-tier-app-eks.svc.cluster.local`
   - Kubernetes DNS resolves this to the actual RDS endpoint
   - Applications don't need to know the real database hostname

2. **Service Discovery**:
   ```
   Application Pod → Kubernetes DNS → ExternalName Service → AWS RDS
   ```

3. **Benefits**:
   - **Abstraction**: Applications use consistent internal names
   - **Flexibility**: Can change database endpoints without updating applications
   - **Environment Agnostic**: Same application code works across environments

#### Real-World Analogy
Think of ExternalName Service like a **phone book entry**:
- You call "Pizza Place" (internal name)
- Phone book translates it to actual phone number (external endpoint)
- If pizza place changes numbers, you only update the phone book, not your memory

### Credential Management Strategy

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

### Database Connectivity Testing Strategy

#### Why Testing is Essential

**Business Impact**:
- **Application Failures**: Apps can't start without database connectivity
- **Data Loss Risk**: Failed connections can lead to data inconsistencies
- **Deployment Delays**: Connectivity issues block entire deployment pipeline
- **Debugging Complexity**: Network issues are harder to diagnose in production

#### Testing Methodology

Our testing strategy follows a **layered approach**:

1. **Layer 1: DNS Resolution**
   ```bash
   # Test: Can Kubernetes resolve the database service name?
   kubectl run dns-test --image=tutum/dnsutils -- dig postgres-db.3-tier-app-eks.svc.cluster.local
   ```

2. **Layer 2: Network Connectivity**
   ```bash
   # Test: Can pods reach the database endpoint?
   kubectl run network-test --image=busybox -- nslookup bootcamp-dev-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com
   ```

3. **Layer 3: Authentication**
   ```bash
   # Test: Can pods authenticate with current credentials?
   kubectl run db-test --image=postgres:13 -- psql -h postgres-db... -U postgres -d postgres
   ```

4. **Layer 4: Application Queries**
   ```bash
   # Test: Can pods execute actual database operations?
   psql -c "SELECT version();"
   ```

### Automation Solution: update-db-secrets.sh Script

#### Script Purpose and Design

**File Location**: `/DevOps-Project-36/3-tier-app-eks/k8s/update-db-secrets.sh`

**Design Philosophy**:
- **Idempotent**: Can be run multiple times safely
- **Self-Healing**: Automatically fixes credential mismatches
- **Comprehensive**: Handles retrieval, parsing, updating, and testing
- **User-Friendly**: Provides clear progress indicators and error messages

#### Script Workflow Breakdown

```bash
#!/bin/bash
# Step-by-step breakdown of what the script does:

# 1. CREDENTIAL RETRIEVAL
aws secretsmanager get-secret-value --secret-id db/bootcamp-dev-db
# → Retrieves: postgresql://postgres:cvf4BntZBh@host:5432/postgres

# 2. PARSING COMPONENTS
# Uses sed regex to extract:
DB_USER=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')     # → postgres
DB_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') # → cvf4BntZBh
DB_HOST=$(echo "$SECRET_VALUE" | sed -n 's/.*@\([^:]*\):.*/\1/p')         # → host
DB_NAME=$(echo "$SECRET_VALUE" | sed -n 's/.*\/\([^?]*\).*/\1/p')         # → postgres

# 3. BASE64 ENCODING
# Kubernetes secrets require base64 encoding:
DB_PASSWORD_B64=$(echo -n "$DB_PASSWORD" | base64 -w 0)

# 4. KUBERNETES SECRET UPDATE
kubectl patch secret db-secrets -n 3-tier-app-eks --type='merge' -p="{...}"

# 5. CONNECTIVITY TESTING
kubectl run db-connectivity-test --image=postgres:13 -- psql -h postgres-db...
```

#### Technical Implementation Details

**Regex Pattern Explanation**:
```bash
# Pattern: postgresql://username:password@host:port/database
# Regex breakdown for password extraction:
's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p'

# Breaking it down:
.*:\/\/        # Match "postgresql://"
[^:]*:         # Match username and colon
\([^@]*\)      # CAPTURE GROUP: password (everything until @)
@.*            # Match @ and everything after
/\1/p          # Replace entire string with captured group (password)
```

**Base64 Encoding Rationale**:
- Kubernetes secrets store data in base64 format
- `-w 0` flag prevents line wrapping
- `-n` flag prevents adding newline characters

**kubectl patch Strategy**:
- Uses `--type='merge'` for partial updates
- Only updates credential fields, preserves other secret data
- Atomic operation - either succeeds completely or fails completely

### Project-Specific Implementation

#### Integration with 3-Tier Architecture

**Frontend Tier**:
- React application (no direct database access)
- Communicates with backend via REST APIs

**Backend Tier**:
- Node.js/Express application
- Uses database credentials from Kubernetes secrets
- Environment variables populated from secret:
  ```yaml
  env:
  - name: DB_HOST
    valueFrom:
      secretKeyRef:
        name: db-secrets
        key: DB_HOST
  ```

**Database Tier**:
- AWS RDS PostgreSQL (external to cluster)
- Accessed via ExternalName service
- Credentials managed through AWS Secrets Manager

#### Deployment Workflow Integration

**Phase 1: Infrastructure**
```bash
terraform apply  # Creates RDS, stores credentials in Secrets Manager
```

**Phase 2: Kubernetes Setup**
```bash
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml        # Initial secrets (may be outdated)
kubectl apply -f database-service.yaml  # ExternalName service
```

**Phase 3: Credential Synchronization** ⭐ **THIS IS WHERE OUR SOLUTION FITS**
```bash
./k8s/update-db-secrets.sh  # Syncs credentials and tests connectivity
```

**Phase 4: Application Deployment**
```bash
kubectl apply -f migration_job.yaml  # Database schema setup
kubectl apply -f backend.yaml        # Backend application
kubectl apply -f frontend.yaml       # Frontend application
```

#### Error Scenarios and Handling

**Scenario 1: Credential Mismatch**
```
Symptom: FATAL: password authentication failed
Root Cause: Kubernetes secret has outdated password
Solution: Run update-db-secrets.sh to sync credentials
```

**Scenario 2: Network Connectivity Issues**
```
Symptom: could not connect to server
Root Cause: Security group, VPC, or DNS configuration
Solution: Check network configuration and service endpoints
```

**Scenario 3: Service Discovery Failures**
```
Symptom: could not resolve hostname
Root Cause: ExternalName service misconfiguration
Solution: Verify service definition and DNS resolution
```

### Benefits of This Approach

#### Operational Benefits

1. **Reduced Manual Work**:
   - No manual password copying/pasting
   - Automated credential synchronization
   - Self-service troubleshooting

2. **Improved Reliability**:
   - Eliminates human error in credential management
   - Consistent testing methodology
   - Predictable deployment outcomes

3. **Enhanced Security**:
   - Credentials never stored in code or configuration files
   - Short-lived credential exposure
   - Audit trail through AWS CloudTrail

4. **Better Developer Experience**:
   - Clear error messages and progress indicators
   - Comprehensive troubleshooting documentation
   - Reusable across environments

#### Technical Benefits

1. **Idempotency**: Script can be run multiple times safely
2. **Atomicity**: Operations either succeed completely or fail cleanly
3. **Observability**: Detailed logging and status reporting
4. **Maintainability**: Well-documented and version-controlled

### Alternative Approaches and Trade-offs

#### Alternative 1: External Secrets Operator
```yaml
# Uses Kubernetes operator to sync secrets automatically
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
```

**Pros**: Automatic synchronization, native Kubernetes integration
**Cons**: Additional complexity, operator dependency, learning curve

#### Alternative 2: AWS Secrets CSI Driver
```yaml
# Mounts secrets as volumes in pods
apiVersion: v1
kind: SecretProviderClass
metadata:
  name: db-secrets
spec:
  provider: aws
  parameters:
    objects: |
      - objectName: "db/bootcamp-dev-db"
```

**Pros**: Direct AWS integration, no intermediate secrets
**Cons**: Volume-based access, pod restart required for updates

#### Alternative 3: Hardcoded Configuration
```yaml
# Static configuration (NOT RECOMMENDED)
env:
- name: DB_PASSWORD
  value: "hardcoded-password"
```

**Pros**: Simple implementation
**Cons**: Security risk, no credential rotation, environment-specific

### Why We Chose Our Approach

1. **Simplicity**: Uses standard Kubernetes and AWS tools
2. **Flexibility**: Works with existing deployment patterns
3. **Transparency**: Clear, auditable process
4. **Learning Value**: Demonstrates core concepts without abstraction layers
5. **Maintainability**: Easy to understand and modify

This approach provides a solid foundation for understanding database connectivity patterns in Kubernetes while maintaining security and operational best practices.