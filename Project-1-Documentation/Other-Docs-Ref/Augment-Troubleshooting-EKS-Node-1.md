# EKS Node Group Troubleshooting Guide: NodeCreationFailure Resolution

## Overview
This document provides a comprehensive step-by-step troubleshooting approach for resolving EKS node group creation failures, specifically the `NodeCreationFailure: Unhealthy nodes in the kubernetes cluster` error encountered during infrastructure deployment.

## Initial Error Analysis

### Error Encountered
```
Error: waiting for EKS Node Group (bootcamp-dev-cluster:example-20250704142506865000000016) create: unexpected state 'CREATE_FAILED', wanted target 'ACTIVE'. last error: i-0c925ed79229abc44: NodeCreationFailure: Unhealthy nodes in the kubernetes cluster
```

### Error Interpretation
- **Error Type**: `NodeCreationFailure`
- **Symptom**: Unhealthy nodes in Kubernetes cluster
- **Impact**: EKS worker nodes unable to join the cluster
- **Instance ID**: `i-0c925ed79229abc44` (specific failing instance)

## Systematic Troubleshooting Approach

### Phase 1: Environment Verification

#### Step 1.1: Verify AWS CLI Configuration
**Command:**
```bash
aws sts get-caller-identity
```

**Output:**
```json
{
    "UserId": "AIDA4T4OCBOQUFNR74DB4",
    "Account": "867344452513",
    "Arn": "arn:aws:iam::867344452513:user/admin-user"
}
```

**Analysis:** ✅ AWS CLI properly configured with correct account access.

#### Step 1.2: Verify EKS Cluster Status
**Command:**
```bash
aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1
```

**Key Output Analysis:**
```json
{
    "cluster": {
        "name": "bootcamp-dev-cluster",
        "status": "ACTIVE",
        "version": "1.31",
        "endpoint": "https://DD86BA67472C0E5C2CC6E97F62ADBD37.gr7.us-east-1.eks.amazonaws.com",
        "resourcesVpcConfig": {
            "subnetIds": [
                "subnet-0ebce96ce44f6c85e",
                "subnet-08ff7f476877624e3",
                "subnet-0766774192fb4f07d",
                "subnet-0e25452a88c1e2fe7"
            ],
            "vpcId": "vpc-005fd7f867c107e80",
            "endpointPublicAccess": true,
            "endpointPrivateAccess": true
        }
    }
}
```

**Analysis:** ✅ EKS cluster is ACTIVE and properly configured.

### Phase 2: Node Group Analysis

#### Step 2.1: Examine Failed Node Group
**Command:**
```bash
aws eks describe-nodegroup --cluster-name bootcamp-dev-cluster --nodegroup-name example-20250704142506865000000016 --region us-east-1
```

**Critical Output:**
```json
{
    "nodegroup": {
        "status": "CREATE_FAILED",
        "health": {
            "issues": [
                {
                    "code": "NodeCreationFailure",
                    "message": "Unhealthy nodes in the kubernetes cluster",
                    "resourceIds": [
                        "i-0c925ed79229abc44"
                    ]
                }
            ]
        }
    }
}
```

**Analysis:** 🔍 Node group failed with specific instance `i-0c925ed79229abc44` having health issues.

#### Step 2.2: Investigate Failing EC2 Instance
**Command:**
```bash
aws ec2 describe-instances --instance-ids i-0c925ed79229abc44 --region us-east-1
```

**Key Findings:**
```json
{
    "Instances": [
        {
            "InstanceId": "i-0c925ed79229abc44",
            "State": {
                "Code": 16,
                "Name": "running"
            },
            "PrivateIpAddress": "10.0.4.223",
            "SubnetId": "subnet-08ff7f476877624e3",
            "VpcId": "vpc-005fd7f867c107e80"
        }
    ]
}
```

**Analysis:** ✅ EC2 instance is running, indicating the issue is not with instance launch but with cluster joining.

### Phase 3: Deep Dive Analysis

#### Step 3.1: Examine Instance Bootstrap Logs
**Command:**
```bash
aws ec2 get-console-output --instance-id i-0c925ed79229abc44 --region us-east-1 --output text
```

**Critical Log Entry Found:**
```
[    9.302101] cloud-init[1468]: 2025-07-04 14:26:06,624 - __init__.py[WARNING]: Unhandled unknown content-type (application/node.eks.aws) userdata: 'b'---'...'
```

**Analysis:** 🚨 **CRITICAL FINDING**: Cloud-init warning about unhandled EKS-specific userdata content type, suggesting bootstrap process issues.

#### Step 3.2: Verify Network Configuration
**Command:**
```bash
aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-005fd7f867c107e80" --region us-east-1
```

**Subnet Tag Verification:**
```json
{
    "Tags": [
        {
            "Key": "kubernetes.io/cluster/bootcamp-dev-cluster",
            "Value": "shared"
        },
        {
            "Key": "kubernetes.io/role/internal-elb",
            "Value": "1"
        }
    ]
}
```

**Analysis:** ✅ Subnet tags are correctly configured for EKS.

#### Step 3.3: Verify Route Tables
**Command:**
```bash
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-005fd7f867c107e80" --region us-east-1
```

**Key Route Analysis:**
```json
{
    "Routes": [
        {
            "DestinationCidrBlock": "0.0.0.0/0",
            "NatGatewayId": "nat-01e99038e38630942",
            "State": "active"
        }
    ]
}
```

**Analysis:** ✅ Private subnets have proper NAT gateway routes for internet access.

#### Step 3.4: Verify IAM Roles and Policies
**Command:**
```bash
aws iam list-attached-role-policies --role-name example-eks-node-group-20250704141439678600000002 --region us-east-1
```

**Output:**
```json
{
    "AttachedPolicies": [
        {
            "PolicyName": "AmazonEKS_CNI_Policy",
            "PolicyArn": "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
        },
        {
            "PolicyName": "AmazonEC2ContainerRegistryReadOnly",
            "PolicyArn": "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
        },
        {
            "PolicyName": "AmazonEKSWorkerNodePolicy",
            "PolicyArn": "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
        }
    ]
}
```

**Analysis:** ✅ All required IAM policies are attached.

### Phase 4: Root Cause Identification

#### Step 4.1: Check EKS Add-ons Status
**Command:**
```bash
aws eks list-addons --cluster-name bootcamp-dev-cluster --region us-east-1
```

**Critical Discovery:**
```json
{
    "addons": []
}
```

**Analysis:** 🚨 **ROOT CAUSE IDENTIFIED**: No EKS add-ons are installed!

#### Step 4.2: Verify Add-on Configuration in Terraform
**Command:**
```bash
terraform state list | grep addon
```

**Output:**
```
module.eks.data.aws_eks_addon_version.this["coredns"]
module.eks.data.aws_eks_addon_version.this["eks-pod-identity-agent"]
module.eks.data.aws_eks_addon_version.this["kube-proxy"]
module.eks.data.aws_eks_addon_version.this["vpc-cni"]
```

**Analysis:** 🔍 Add-ons are defined as data sources but not created as actual resources.

## Root Cause Analysis

### Primary Issue
**Missing EKS Add-ons**: The EKS cluster was created without essential add-ons, particularly the VPC CNI add-on, which is critical for pod networking and node-to-cluster communication.

### Why This Caused Node Failure
1. **VPC CNI Missing**: Without the VPC CNI add-on, nodes cannot properly configure networking
2. **Bootstrap Failure**: The cloud-init warning about unhandled EKS userdata indicates the bootstrap process couldn't complete
3. **Cluster Communication**: Nodes couldn't establish proper communication with the EKS control plane
4. **Health Check Failure**: EKS health checks failed because nodes couldn't join the cluster network

### Configuration Analysis
The original EKS configuration had add-ons defined but not properly configured:

```hcl
cluster_addons = {
  coredns                = {}
  eks-pod-identity-agent = {}
  kube-proxy             = {}
  vpc-cni                = {}
}
```

**Problem**: Empty configuration blocks don't ensure add-ons are created with proper dependencies.

## Solution Implementation

### Step 1: Enhanced Add-on Configuration
**Modified Configuration:**
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
    before_compute = true  # Critical: Install before node groups
  }
}
```

**Key Changes:**
- Added `most_recent = true` to ensure latest compatible versions
- Added `before_compute = true` for VPC CNI to ensure it's installed before node groups

### Step 2: Clean Up Failed Resources
**Command:**
```bash
terraform destroy -target=module.eks.module.eks_managed_node_group -auto-approve
```

**Result:** Successfully removed failed node group and associated resources.

### Step 3: Redeploy with Fixed Configuration
**Command:**
```bash
terraform apply -auto-approve
```

**Success Output:**
```
Apply complete! Resources: 11 added, 0 changed, 0 destroyed.
```

## Verification of Fix

### Add-ons Successfully Created
The deployment created the following add-ons in the correct order:
1. `vpc-cni` (before compute resources)
2. `eks-pod-identity-agent`
3. `kube-proxy`
4. `coredns`

### Node Group Creation Success
The node group was successfully created after add-ons were installed:
```
module.eks.module.eks_managed_node_group["example"].aws_eks_node_group.this[0]: Creation complete after 2m3s
```

## Key Learnings and Best Practices

### 1. Add-on Dependencies
- **Always install VPC CNI before node groups** using `before_compute = true`
- **Use `most_recent = true`** to ensure compatible versions
- **Install add-ons in the correct order**: VPC CNI → Node Groups → Other Add-ons

### 2. Troubleshooting Methodology
- **Start with high-level status** (cluster, node group)
- **Examine specific failing resources** (EC2 instances)
- **Check logs and bootstrap processes** (console output)
- **Verify network and IAM configurations**
- **Identify missing dependencies** (add-ons, policies)

### 3. Common EKS Node Failure Causes
1. **Missing or misconfigured add-ons** (most common)
2. **Incorrect subnet tags**
3. **Missing NAT gateway routes**
4. **IAM policy issues**
5. **Security group misconfigurations**

### 4. Prevention Strategies
- **Use explicit add-on configurations** with proper dependencies
- **Implement proper tagging** for EKS resources
- **Verify network connectivity** before node group creation
- **Test in staging environments** before production deployment

## Conclusion

The `NodeCreationFailure` was successfully resolved by identifying that EKS add-ons, particularly the VPC CNI, were not being created despite being defined in the Terraform configuration. The fix involved:

1. **Enhanced add-on configuration** with explicit version and dependency management
2. **Proper ordering** of resource creation (add-ons before node groups)
3. **Clean deployment** after removing failed resources

This systematic troubleshooting approach demonstrates the importance of examining all layers of the EKS infrastructure stack when diagnosing node group failures.

## Detailed Command Reference

### Essential Troubleshooting Commands

#### Cluster Status Commands
```bash
# Check cluster status
aws eks describe-cluster --name <cluster-name> --region <region>

# List all clusters
aws eks list-clusters --region <region>

# Check cluster add-ons
aws eks list-addons --cluster-name <cluster-name> --region <region>

# Describe specific add-on
aws eks describe-addon --cluster-name <cluster-name> --addon-name <addon-name> --region <region>
```

#### Node Group Diagnostics
```bash
# List node groups
aws eks list-nodegroups --cluster-name <cluster-name> --region <region>

# Describe node group
aws eks describe-nodegroup --cluster-name <cluster-name> --nodegroup-name <nodegroup-name> --region <region>

# Check node group health
aws eks describe-nodegroup --cluster-name <cluster-name> --nodegroup-name <nodegroup-name> --region <region> --query 'nodegroup.health'
```

#### EC2 Instance Analysis
```bash
# Describe instances in node group
aws ec2 describe-instances --filters "Name=tag:eks:nodegroup-name,Values=<nodegroup-name>" --region <region>

# Get instance console output
aws ec2 get-console-output --instance-id <instance-id> --region <region> --output text

# Check instance status
aws ec2 describe-instance-status --instance-ids <instance-id> --region <region>
```

#### Network Verification
```bash
# Check VPC subnets
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<vpc-id>" --region <region>

# Verify route tables
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=<vpc-id>" --region <region>

# Check NAT gateways
aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=<vpc-id>" --region <region>

# Verify security groups
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=<vpc-id>" --region <region>
```

#### IAM Verification
```bash
# Check node group role policies
aws iam list-attached-role-policies --role-name <node-group-role-name>

# Verify role trust policy
aws iam get-role --role-name <node-group-role-name> --query 'Role.AssumeRolePolicyDocument'

# Check cluster role policies
aws iam list-attached-role-policies --role-name <cluster-role-name>
```

## Terraform State Analysis

### Useful Terraform Commands for Troubleshooting
```bash
# List all resources
terraform state list

# Show specific resource details
terraform state show <resource-address>

# Check for addon resources
terraform state list | grep addon

# Validate configuration
terraform validate

# Plan with detailed output
terraform plan -detailed-exitcode

# Apply specific targets
terraform apply -target=<resource-address>

# Destroy specific targets
terraform destroy -target=<resource-address>
```

## Error Patterns and Solutions

### Common Error Patterns

#### 1. NodeCreationFailure: Unhealthy nodes
**Symptoms:**
- Nodes fail to join cluster
- CREATE_FAILED status
- Health check failures

**Common Causes:**
- Missing VPC CNI add-on
- Incorrect subnet configuration
- Security group issues
- IAM permission problems

**Solution Approach:**
1. Check add-on installation
2. Verify network configuration
3. Validate IAM roles
4. Review security groups

#### 2. NodeCreationFailure: Instances failed to join cluster
**Symptoms:**
- Instances launch but don't join
- Bootstrap script failures
- Networking issues

**Common Causes:**
- Missing cluster tags on subnets
- No internet access for private subnets
- Incorrect AMI type
- User data script issues

#### 3. NodeCreationFailure: Capacity issues
**Symptoms:**
- InsufficientInstanceCapacity
- No available instances
- Specific AZ failures

**Common Causes:**
- Instance type not available in AZ
- Service quotas exceeded
- Spot instance unavailability

### Troubleshooting Decision Tree

```
NodeCreationFailure Error
├── Check Cluster Status
│   ├── ACTIVE → Continue
│   └── NOT ACTIVE → Fix cluster first
├── Check Add-ons
│   ├── VPC CNI Missing → Install add-ons
│   └── Add-ons Present → Check network
├── Check Network Configuration
│   ├── Subnet Tags Missing → Add EKS tags
│   ├── No NAT Gateway → Add NAT gateway
│   └── Security Groups → Verify rules
├── Check IAM Roles
│   ├── Missing Policies → Attach required policies

## Infrastructure Redeployment After Terraform Destroy

### Issue Summary
After partially deploying the 3-tier application (completing Phases 1, 2, and part of Phase 3 from the 3-Tier-Deployment-Document.md), you encountered database connectivity issues due to the RDS instance being deployed in ap-south-1 while the EKS cluster was in us-east-1. After running `terraform destroy`, you need to redeploy with the correct region configuration.

### Challenges
1. Resources created via kubectl or AWS CLI may not be tracked by Terraform
2. Lingering resources can cause naming conflicts during redeployment
3. Cross-region resources (like the RDS instance in ap-south-1) need special handling
4. IAM roles, security groups, and load balancers might have dependencies preventing clean deletion

### RDS Region Configuration Fix

The core issue is that your RDS instance was deployed in ap-south-1 while your EKS cluster is in us-east-1. This cross-region setup causes connectivity issues. Here's how to fix it:

#### Step 1: Check for Region Override in RDS Configuration

First, examine your RDS configuration for any explicit region settings:

```bash
# Navigate to your Terraform directory
cd /home/geek/2025-DevOps-Projects/CI-CD-Projects/NotHarshhaa-DevOps-Projects/DevOps-Projects/DevOps-Project-36/3-tier-app-eks/infra/

# Check for provider overrides in rds.tf
grep -n "provider" rds.tf

# Check for hardcoded region values
grep -n "ap-south-1" rds.tf
```

#### Step 2: Fix RDS Configuration

If you find any provider overrides or hardcoded regions in rds.tf, remove them:

```bash
# If there's a provider block in rds.tf like:
# provider "aws" {
#   region = "ap-south-1"
# }
# Remove it or comment it out

# If there are hardcoded availability zones like:
# availability_zone = "ap-south-1a"
# Change them to use variables:
# availability_zone = "${var.aws_region}a"
```

#### Step 3: Update Subnet Configuration for RDS

Ensure the RDS subnets are in the correct availability zones:

```bash
# Open the file that defines RDS subnets (likely network.tf or rds.tf)
# Look for code like:
resource "aws_subnet" "rds_1" {
  cidr_block        = "10.0.5.0/24"
  availability_zone = "ap-south-1a"  # This needs to change
  vpc_id            = module.eks_network.vpc_id
}

resource "aws_subnet" "rds_2" {
  cidr_block        = "10.0.6.0/24"
  availability_zone = "ap-south-1b"  # This needs to change
  vpc_id            = module.eks_network.vpc_id
}

# Update to:
resource "aws_subnet" "rds_1" {
  cidr_block        = "10.0.5.0/24"
  availability_zone = "${var.aws_region}a"  # Using variable
  vpc_id            = module.eks_network.vpc_id
}

resource "aws_subnet" "rds_2" {
  cidr_block        = "10.0.6.0/24"
  availability_zone = "${var.aws_region}b"  # Using variable
  vpc_id            = module.eks_network.vpc_id
}
```

#### Step 4: Ensure Global AWS Provider Uses the Correct Region

Make sure your main provider configuration uses the correct region:

```bash
# Check providers.tf
cat providers.tf

# If it doesn't exist or doesn't use the variable, create/update it:
cat > providers.tf << EOF
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.95.0, < 6.0.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
EOF
```

#### Step 5: Verify Region Variable is Set Correctly

```bash
# Check terraform.tfvars
grep aws_region terraform.tfvars

# If not set or incorrect, update it:
echo 'aws_region = "us-east-1"' > terraform.tfvars

# Check variables.tf
grep -A 5 "aws_region" variables.tf

# If not defined correctly, add/update it:
cat >> variables.tf << EOF
variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}
EOF
```

### Pre-Deployment Cleanup Checklist

Before redeploying the infrastructure, it's crucial to identify and clean up any resources that might cause conflicts. These typically include resources created outside of Terraform or resources that might not have been properly destroyed.

#### Step 1: Check for Lingering EKS Resources

```bash
# List all EKS clusters in the account
aws eks list-clusters --region us-east-1

# If bootcamp-dev-cluster still exists, delete it
if aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 &> /dev/null; then
  echo "EKS cluster still exists, deleting..."
  aws eks delete-cluster --name bootcamp-dev-cluster --region us-east-1
  # Wait for deletion to complete
  aws eks wait cluster-deleted --name bootcamp-dev-cluster --region us-east-1
else
  echo "EKS cluster not found, proceeding..."
fi
```

#### Step 2: Check for Lingering RDS Instances

```bash
# List all RDS instances in both regions
aws rds describe-db-instances --region us-east-1 --query "DBInstances[?contains(DBInstanceIdentifier, 'bootcamp-dev-db')].{ID:DBInstanceIdentifier,Status:DBInstanceStatus}" --output table
aws rds describe-db-instances --region ap-south-1 --query "DBInstances[?contains(DBInstanceIdentifier, 'bootcamp-dev-db')].{ID:DBInstanceIdentifier,Status:DBInstanceStatus}" --output table

# If instances exist, delete them
for region in "us-east-1" "ap-south-1"; do
  for db in $(aws rds describe-db-instances --region $region --query "DBInstances[*].DBInstanceIdentifier" --output text); do
    if [[ $db == *"bootcamp-dev"* ]]; then
      echo "Deleting RDS instance $db in $region..."
      aws rds delete-db-instance --db-instance-identifier $db --skip-final-snapshot --region $region
    fi
  done
done
```

#### Step 3: Check for Lingering Load Balancers

```bash
# List all load balancers
aws elbv2 describe-load-balancers --region us-east-1 --query "LoadBalancers[*].{Name:LoadBalancerName,DNSName:DNSName}" --output table

# Delete any load balancers related to your project
# Note: This is a manual step as you need to identify which LBs are related to your project
# aws elbv2 delete-load-balancer --load-balancer-arn <load-balancer-arn> --region us-east-1
```

#### Step 4: Check for Lingering Security Groups

```bash
# List all security groups
aws ec2 describe-security-groups --region us-east-1 --query "SecurityGroups[?contains(GroupName, 'bootcamp-dev') || contains(GroupName, 'eks')].{ID:GroupId,Name:GroupName}" --output table

# Note: Don't delete security groups yet as they might have dependencies
# We'll handle them during Terraform deployment
```

#### Step 5: Check for Lingering IAM Roles and Policies

```bash
# List IAM roles related to EKS
aws iam list-roles --query "Roles[?contains(RoleName, 'bootcamp-dev') || contains(RoleName, 'eks')].RoleName" --output table

# List IAM policies
aws iam list-policies --scope Local --query "Policies[?contains(PolicyName, 'bootcamp-dev') || contains(PolicyName, 'eks')].PolicyName" --output table

# Note: Don't delete IAM roles/policies yet as they might have dependencies
# We'll handle them during Terraform deployment
```

#### Step 6: Check for Lingering Secrets Manager Secrets

```bash
# List all secrets
aws secretsmanager list-secrets --region us-east-1 --query "SecretList[?contains(Name, 'db/bootcamp-dev-db')].{Name:Name,ARN:ARN}" --output table

# Delete any secrets related to your project
for secret in $(aws secretsmanager list-secrets --region us-east-1 --query "SecretList[?contains(Name, 'db/bootcamp-dev-db')].ARN" --output text); do
  echo "Deleting secret $secret..."
  aws secretsmanager delete-secret --secret-id $secret --force-delete-without-recovery --region us-east-1
done
```

### Terraform State Reset

Before redeploying, ensure your Terraform state is clean:

```bash
# Navigate to your Terraform directory
cd /home/geek/2025-DevOps-Projects/CI-CD-Projects/NotHarshhaa-DevOps-Projects/DevOps-Projects/DevOps-Project-36/3-tier-app-eks/infra/

# Check current state
terraform state list

# If there are any resources still in the state, remove them
# terraform state rm <resource_address>

# Or, for a complete reset (use with caution)
rm -rf .terraform .terraform.lock.hcl terraform.tfstate terraform.tfstate.backup

# Reinitialize Terraform
terraform init
```

### Configuration Validation and Updates

Before redeploying, update your Terraform configuration to fix the region mismatch issue:

#### Step 1: Ensure Consistent Region Configuration

```bash
# Check the region in terraform.tfvars
grep aws_region terraform.tfvars

# If not set or incorrect, update it
echo 'aws_region = "us-east-1"' >> terraform.tfvars

# Ensure provider.tf uses the variable
cat > providers.tf << EOF
provider "aws" {
  region = var.aws_region
}
EOF

# Ensure variables.tf has the region variable
grep -q "aws_region" variables.tf || echo '
variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}' >> variables.tf
```

#### Step 2: Update RDS Configuration

Ensure your RDS configuration uses the correct region and doesn't have any hardcoded region values:

```bash
# Check for hardcoded regions in RDS configuration
grep -r "ap-south-1" --include="*.tf" .

# If found, update those files to use var.aws_region instead
```

### Redeployment Strategy

Now that you've cleaned up lingering resources and fixed your configuration, follow this strategy for redeployment:

#### Step 1: Plan and Apply Infrastructure

```bash
# Generate and review the plan
terraform plan -out=tfplan

# Apply the plan
terraform apply tfplan
```

#### Step 2: Verify Infrastructure Deployment

```bash
# Check EKS cluster status
aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query 'cluster.status'

# Check RDS instance status
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier,`bootcamp-dev-db`)].DBInstanceStatus'

# Configure kubectl
aws eks update-kubeconfig --region us-east-1 --name bootcamp-dev-cluster

# Verify node group
kubectl get nodes
```

#### Step 3: Deploy Kubernetes Resources in the Correct Order

```bash
# Navigate to k8s directory
cd ../k8s/

# 1. Create namespace
kubectl apply -f namespace.yaml

# 2. Deploy secrets and configmaps
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml

# 3. Update database service with correct RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances --region us-east-1 --query "DBInstances[?contains(DBInstanceIdentifier,'bootcamp-dev-db')].Endpoint.Address" --output text)

cat > database-service.yaml << EOF
apiVersion: v1
kind: Service
metadata:
  name: postgres-db
  namespace: 3-tier-app-eks
  labels:
    service: database
spec:
  type: ExternalName
  externalName: $RDS_ENDPOINT
  ports:
  - port: 5432
EOF

kubectl apply -f database-service.yaml

# 4. Test database connectivity
kubectl run -it --rm --restart=Never dns-test --image=tutum/dnsutils -- dig postgres-db.3-tier-app-eks.svc.cluster.local

# 5. Deploy remaining resources
kubectl apply -f migration_job.yaml
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml
kubectl apply -f ingress.yaml
```

### Potential Conflicts and Mitigation Strategies

#### 1. Secret Manager Conflicts

**Issue**: Existing secrets with the same name but inaccessible due to KMS key issues.

**Mitigation**:
```bash
# Check for existing secrets
aws secretsmanager list-secrets --region us-east-1 --query "SecretList[?contains(Name, 'db/bootcamp-dev-db')].Name" --output table

# Delete any existing secrets before Terraform apply
for secret in $(aws secretsmanager list-secrets --region us-east-1 --query "SecretList[?contains(Name, 'db/bootcamp-dev-db')].Name" --output text); do
  aws secretsmanager delete-secret --secret-id $secret --force-delete-without-recovery --region us-east-1
done
```

#### 2. IAM Role Conflicts

**Issue**: IAM roles might still exist but with incorrect trust relationships.

**Mitigation**:
```bash
# Check for existing roles
aws iam list-roles --query "Roles[?contains(RoleName, 'bootcamp-dev') || contains(RoleName, 'eks')].RoleName" --output table

# For each role, check if it's properly configured
# If not, delete it before Terraform apply
# aws iam delete-role --role-name <role-name>
```

#### 3. Security Group Rule Conflicts

**Issue**: Security groups might have rules that conflict with new deployments.

**Mitigation**:
```bash
# Identify security groups
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*bootcamp-dev*" --query "Vpcs[0].VpcId" --output text --region us-east-1)
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[*].{ID:GroupId,Name:GroupName}" --output table --region us-east-1

# For problematic security groups, reset rules
# aws ec2 revoke-security-group-ingress --group-id <group-id> --security-group-rule-ids <rule-id> --region us-east-1
```

#### 4. Load Balancer Conflicts

**Issue**: Load balancers created by the Kubernetes Ingress Controller might not be properly deleted.

**Mitigation**:
```bash
# List load balancers
aws elbv2 describe-load-balancers --region us-east-1 --query "LoadBalancers[*].{Name:LoadBalancerName,ARN:LoadBalancerArn}" --output table

# Delete any lingering load balancers
# aws elbv2 delete-load-balancer --load-balancer-arn <load-balancer-arn> --region us-east-1
```

### Monitoring and Verification

After redeployment, perform these verification steps:

```bash
# Check all Kubernetes resources
kubectl get all -n 3-tier-app-eks

# Test database connectivity
kubectl run db-test --rm -it --image=postgres:13 -n 3-tier-app-eks -- bash -c "
PGPASSWORD=YourStrongPassword123! psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U postgresadmin -d postgres -c \"SELECT 'Database connection successful!' as status;\"
"

# Check ingress
kubectl get ingress -n 3-tier-app-eks

# Get the ALB DNS name
ALB_DNS=$(kubectl get ingress -n 3-tier-app-eks -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}')
echo "Application URL: http://$ALB_DNS"

# Test frontend access
curl -s -o /dev/null -w "%{http_code}" http://$ALB_DNS/

# Test backend API
curl -s -o /dev/null -w "%{http_code}" http://$ALB_DNS/api/topics
```

### Lessons Learned

1. **Region Consistency**: Always deploy related infrastructure components in the same AWS region.
2. **Configuration Management**: Use variables for region specification and reference them consistently.
3. **Resource Cleanup**: Ensure proper cleanup of all resources when destroying infrastructure.
4. **State Management**: Maintain a clean Terraform state to avoid conflicts during redeployment.
5. **Dependency Tracking**: Be aware of resource dependencies, especially for cross-region resources.

By following this comprehensive strategy, you can successfully redeploy your infrastructure while avoiding conflicts with any lingering resources from previous deployments.
     ports:
     - port: 5432
   EOF
   
   # Apply the service
   kubectl apply -f database-service.yaml
   ```

2. **Verify Service Configuration**
   ```bash
   # Check the service
   kubectl get svc postgres-db -n 3-tier-app-eks -o yaml
   
   # Test DNS resolution
   kubectl run -it --rm --restart=Never dns-test --image=tutum/dnsutils -- dig postgres-db.3-tier-app-eks.svc.cluster.local
   ```

#### Phase 6: Configure Security Groups

1. **Update RDS Security Group**
   ```bash
   # Get the EKS node security group
   EKS_NODE_SG=$(aws eks describe-cluster \
     --name bootcamp-dev-cluster \
     --region us-east-1 \
     --query "cluster.resourcesVpcConfig.securityGroupIds[0]" \
     --output text)
   
   # Get the RDS security group
   RDS_SG=$(aws rds describe-db-instances \
     --db-instance-identifier bootcamp-dev-db \
     --region us-east-1 \
     --query "DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId" \
     --output text)
   
   # Allow inbound PostgreSQL traffic from EKS nodes to RDS
   aws ec2 authorize-security-group-ingress \
     --group-id $RDS_SG \
     --protocol tcp \
     --port 5432 \
     --source-group $EKS_NODE_SG \
     --region us-east-1
   ```

#### Phase 7: Initialize Database and Test Connectivity

1. **Initialize the Database**
   ```bash
   # Create a job to initialize the database
   cat > db-init-job.yaml << EOF
   apiVersion: batch/v1
   kind: Job
   metadata:
     name: database-init
     namespace: 3-tier-app-eks
   spec:
     template:
       spec:
         containers:
         - name: db-init
           image: postgres:13
           command: ["/bin/bash", "-c"]
           args:
           - |
             PGPASSWORD=YourStrongPassword123! psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U postgresadmin -d postgres -c "
             CREATE TABLE IF NOT EXISTS topics (
               id SERIAL PRIMARY KEY,
               name VARCHAR(100) NOT NULL,
               description TEXT,
               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
             );
             
             INSERT INTO topics (name, description) VALUES 
             ('Kubernetes', 'Container orchestration system'),
             ('Docker', 'Containerization platform'),
             ('Terraform', 'Infrastructure as Code tool')
             ON CONFLICT DO NOTHING;
             "
             echo "Database initialization completed!"
         restartPolicy: Never
     backoffLimit: 4
   EOF
   
   kubectl apply -f db-init-job.yaml
   
   # Monitor the job
   kubectl logs job/database-init -n 3-tier-app-eks -f
   ```

2. **Test Database Connectivity**
   ```bash
   # Test connectivity
   kubectl run db-test --rm -it --image=postgres:13 -n 3-tier-app-eks -- bash -c "
   PGPASSWORD=YourStrongPassword123! psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U postgresadmin -d postgres -c \"SELECT 'Database connection successful!' as status;\"
   "
   
   # Test with a query
   kubectl run query-test --rm -it --image=postgres:13 -n 3-tier-app-eks -- bash -c "
   PGPASSWORD=YourStrongPassword123! psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U postgresadmin -d postgres -c \"SELECT COUNT(*) FROM topics;\"
   "
   ```

### Lessons Learned and Best Practices

1. **Region Consistency**
   - Always use the same region for all related infrastructure components
   - Use variables for region specification and reference them consistently
   - Include region validation in your CI/CD pipeline

2. **Infrastructure Documentation**
   - Document the region for each component
   - Create architecture diagrams showing region boundaries
   - Use resource tagging to indicate the expected region

3. **Migration Planning**
   - When migrating between regions, create a comprehensive checklist
   - Migrate related components together (EKS and RDS should be migrated as a unit)
   - Test cross-component connectivity after migration

4. **Configuration Management**
   - Use modules with consistent region handling
   - Implement validation to prevent cross-region dependencies
   - Consider using Terraform workspaces for multi-region deployments

### Prevention Strategies

To prevent this issue in the future:

1. **Centralized Region Configuration**
   ```hcl
   # In variables.tf
   variable "aws_region" {
     description = "AWS region for all resources"
     type        = string
     default     = "us-east-1"
   }
   
   # In providers.tf
   provider "aws" {
     region = var.aws_region
   }
   ```

2. **Region Validation**
   Add a local validation in your Terraform configuration:
   ```hcl
   locals {
     # Extract region from EKS ARN
     eks_region = split(":", module.eks.cluster_arn)[3]
     
     # Extract region from RDS ARN
     rds_region = split(":", aws_db_instance.postgres.arn)[3]
     
     # Validate regions match
     validate_regions = (local.eks_region == local.rds_region) ? true : file("ERROR: EKS and RDS must be in the same region")
   }
   ```

3. **Automated Testing**
   Add a test script to your CI/CD pipeline:
   ```bash
   #!/bin/bash
   # Check if all resources are in the same region
   EKS_REGION=$(aws eks describe-cluster --name $CLUSTER_NAME --query "cluster.arn" --output text | cut -d: -f4)
   RDS_REGION=$(aws rds describe-db-instances --db-instance-identifier $DB_NAME --query "DBInstances[0].DBInstanceArn" --output text | cut -d: -f4)
   
   if [ "$EKS_REGION" != "$RDS_REGION" ]; then
     echo "ERROR: Region mismatch! EKS is in $EKS_REGION but RDS is in $RDS_REGION"
     exit 1
   fi
   ```

By implementing these strategies, you can ensure that all your infrastructure components are deployed in the same region, preventing cross-region connectivity issues in the future.
