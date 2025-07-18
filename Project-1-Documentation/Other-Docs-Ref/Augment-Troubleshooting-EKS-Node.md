# EKS Troubleshooting Guide

## Table of Contents
1. [Root Cause Analysis](#root-cause-analysis)
   - [Primary Issue](#primary-issue)
   - [Why This Caused Node Failure](#why-this-caused-node-failure)
   - [Configuration Analysis](#configuration-analysis)
2. [Solution Implementation](#solution-implementation)
   - [Enhanced Add-on Configuration](#step-1-enhanced-add-on-configuration)
   - [Clean Up Failed Resources](#step-2-clean-up-failed-resources)
   - [Redeploy with Fixed Configuration](#step-3-redeploy-with-fixed-configuration)
3. [Verification of Fix](#verification-of-fix)
4. [Key Learnings and Best Practices](#key-learnings-and-best-practices)
5. [Handling Interrupted Terraform Destroy Operations](#handling-interrupted-terraform-destroy-operations)
   - [Issue Summary](#issue-summary)
   - [Root Cause Analysis](#root-cause-analysis-1)
   - [Verification Steps](#verification-steps)
   - [Solution Implementation](#solution-implementation-1)
   - [Key Learnings](#key-learnings)
   - [Prevention Strategies](#prevention-strategies)
6. [Detailed Command Reference](#detailed-command-reference)
   - [Essential Troubleshooting Commands](#essential-troubleshooting-commands)
   - [Node Group Diagnostics](#node-group-diagnostics)
7. [Common EKS Node Failure Causes](#common-eks-node-failure-causes)
   - [Missing or Misconfigured Add-ons](#missing-or-misconfigured-add-ons)
   - [Incorrect Subnet Tags](#incorrect-subnet-tags)
   - [Missing NAT Gateway Routes](#missing-nat-gateway-routes)
   - [IAM Policy Issues](#iam-policy-issues)
8. [Troubleshooting RDS Connectivity Issues in EKS](#troubleshooting-rds-connectivity-issues-in-eks)
   - [Issue Summary](#rds-connectivity-issue-summary)
   - [Root Cause Analysis](#rds-connectivity-root-cause)
   - [Verification Steps](#rds-connectivity-verification-steps)
   - [Solution Implementation](#rds-connectivity-solution)
   - [Key Learnings](#rds-connectivity-key-learnings)
9. [Database Credential Synchronization Issues in EKS](#database-credential-synchronization-issues-in-eks)
   - [Issue Summary](#issue-summary)
   - [Root Cause Analysis](#root-cause-analysis)
   - [Diagnostic Steps](#diagnostic-steps-to-identify-the-issue)
   - [Solution Implementation](#solution-implementation)
   - [Verification Steps](#verification-steps)
   - [Script Details](#script-details)
   - [Key Learnings](#key-learnings)
   - [Prevention Strategies](#prevention-strategies)

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

## Handling Interrupted Terraform Destroy Operations

### Issue Summary
During the destruction of the EKS cluster using `terraform destroy -auto-approve`, the operation was interrupted due to internet connectivity loss and system shutdown. When attempting to recreate the cluster the following day, various errors appeared despite the cluster having been successfully created multiple times before.

### Root Cause Analysis
When a `terraform destroy` operation is interrupted, it can leave the infrastructure in an inconsistent state:

1. **Partial Resource Deletion**: Some resources may have been deleted while others remain
2. **Terraform State Inconsistency**: The local Terraform state file no longer accurately reflects the actual resources in AWS
3. **Orphaned Resources**: AWS resources that were being deleted might be left in a "deleting" state or partially deleted
4. **Dependency Issues**: Resources with dependencies might be in an inconsistent state

### Verification Steps

To assess the situation after an interrupted destroy operation:

```bash
# Check if EKS cluster still exists
aws eks list-clusters --region us-east-1

# Check for orphaned node groups
aws eks list-nodegroups --cluster-name bootcamp-dev-cluster --region us-east-1

# Check for orphaned EC2 instances
aws ec2 describe-instances --filters "Name=tag:kubernetes.io/cluster/bootcamp-dev-cluster,Values=owned" --region us-east-1

# Check for orphaned IAM roles
aws iam list-roles --query "Roles[?contains(RoleName, 'bootcamp-dev-cluster')]"

# Check for orphaned security groups
aws ec2 describe-security-groups --filters "Name=group-name,Values=*bootcamp-dev-cluster*" --region us-east-1
```

### Solution Implementation

#### Step 1: Refresh Terraform State

First, refresh the Terraform state to sync with the actual AWS resources:

```bash
terraform refresh
```

#### Step 2: Clean Up Orphaned Resources Manually

If resources are stuck in a "deleting" state or weren't properly tracked by Terraform:

```bash
# Delete orphaned node groups if any
aws eks delete-nodegroup --cluster-name bootcamp-dev-cluster --nodegroup-name example --region us-east-1

# Delete orphaned EKS cluster if any
aws eks delete-cluster --name bootcamp-dev-cluster --region us-east-1

# Delete orphaned IAM roles (be careful!)
aws iam detach-role-policy --role-name eks-bootcamp-dev-cluster-node-role --policy-arn arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
aws iam delete-role --role-name eks-bootcamp-dev-cluster-node-role

# Delete orphaned security groups (be careful!)
aws ec2 delete-security-group --group-id sg-12345 --region us-east-1
```

#### Step 3: Reset Terraform State (if necessary)

If the state is severely corrupted and manual cleanup is complete:

```bash
# Create a backup of the current state
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d%H%M%S)

# Initialize a new state
terraform init -reconfigure
```

#### Step 4: Apply with Target (if needed)

If specific resources are causing issues, apply them individually:

```bash
# Apply VPC first
terraform apply -target=module.eks_network

# Then apply EKS cluster
terraform apply -target=module.eks

# Finally apply node groups
terraform apply
```

### Key Learnings

1. **Always Use Remote State**: Store Terraform state in a remote backend (S3 with DynamoDB locking) to prevent state file corruption during interruptions

2. **Implement Proper Timeouts**: Configure longer timeouts for resource creation/destruction in Terraform configurations

3. **Use Targeted Operations**: For large infrastructures, use targeted destroy operations to minimize the impact of interruptions:
   ```bash
   terraform destroy -target=module.eks.module.eks_managed_node_group
   terraform destroy -target=module.eks
   terraform destroy -target=module.eks_network
   ```

4. **Create Cleanup Scripts**: Prepare scripts for manual cleanup of resources in case of interrupted operations

5. **State Backup**: Always back up the Terraform state file before major operations

### Prevention Strategies

1. **Remote State Configuration**:
   ```terraform
   terraform {
     backend "s3" {
       bucket         = "terraform-state-bucket"
       key            = "eks/terraform.tfstate"
       region         = "us-east-1"
       dynamodb_table = "terraform-locks"
       encrypt        = true
     }
   }
   ```

2. **Graceful Shutdown Procedure**:
   - Always allow Terraform operations to complete
   - If interruption is necessary, use Ctrl+C once to trigger graceful termination
   - Wait for Terraform to save state before shutting down the system

3. **Resource Timeouts**:
   ```terraform
   resource "aws_eks_cluster" "example" {
     # ...
     timeouts {
       create = "30m"
       delete = "30m"
     }
   }
   ```

4. **Implement Pre-destroy Hooks**:
   ```terraform
   provisioner "local-exec" {
     when    = destroy
     command = "./pre-destroy-cleanup.sh ${self.id}"
   }
   ```

By following these practices, you can minimize the risk of state inconsistency when Terraform operations are interrupted and have a clear recovery path when interruptions do occur.

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
│   └── Policies Present → Check instance logs
├── Check Instance Logs
│   ├── Bootstrap Errors → Fix user data
│   └── No Errors → Check other issues
```

## EKS Node Group Creation Failure Troubleshooting

### Issue Summary
When deploying EKS node groups with Terraform, you may encounter the following error:
```
Error: waiting for EKS Node Group (bootcamp-dev-cluster:example-20250704142506865000000016) create: unexpected state 'CREATE_FAILED', wanted target 'ACTIVE'. last error: i-0c925ed79229abc44: NodeCreationFailure: Unhealthy nodes in the kubernetes cluster
```

This error indicates that the EC2 instances were created but failed to join the EKS cluster, often due to missing or misconfigured EKS add-ons, particularly the VPC CNI add-on.

### Systematic Troubleshooting Approach

#### Step 1: Verify Cluster and Node Group Status
```bash
# Check if EKS cluster exists
aws eks list-clusters --region us-east-1

# Check node group status (if cluster exists)
aws eks list-nodegroups --cluster-name <cluster-name> --region us-east-1

# Describe the failed node group (if it exists)
aws eks describe-nodegroup --cluster-name <cluster-name> --nodegroup-name <nodegroup-name> --region us-east-1
```

#### Step 2: Check EC2 Instances
```bash
# List EC2 instances associated with the cluster
aws ec2 describe-instances --filters "Name=tag:kubernetes.io/cluster/<cluster-name>,Values=owned" --region us-east-1

# Get console output from a specific instance for bootstrap logs
aws ec2 get-console-output --instance-id <instance-id> --region us-east-1 --output text
```

#### Step 3: Check for Orphaned Resources
```bash
# Check for launch templates
aws ec2 describe-launch-templates --filters "Name=tag:kubernetes.io/cluster/<cluster-name>,Values=owned" --region us-east-1

# Check for security groups
aws ec2 describe-security-groups --filters "Name=tag:kubernetes.io/cluster/<cluster-name>,Values=owned" --region us-east-1

# Check for IAM roles
aws iam list-roles --query "Roles[?contains(RoleName, '<cluster-name>')]"
```

#### Step 4: Check EKS Add-ons
```bash
# List add-ons in the cluster (if cluster exists)
aws eks list-addons --cluster-name <cluster-name> --region us-east-1

# Describe a specific add-on
aws eks describe-addon --cluster-name <cluster-name> --addon-name vpc-cni --region us-east-1
```

### Cleanup Orphaned Resources

If you find orphaned resources after a failed deployment or interrupted Terraform operation:

#### Security Groups
```bash
# Delete orphaned security group
aws ec2 delete-security-group --group-id <security-group-id> --region us-east-1
```

#### IAM Roles
```bash
# First detach policies from the role
aws iam list-attached-role-policies --role-name <role-name>
aws iam detach-role-policy --role-name <role-name> --policy-arn <policy-arn>

# Then delete the role
aws iam delete-role --role-name <role-name>
```

#### Launch Templates
```bash
# Delete orphaned launch template
aws ec2 delete-launch-template --launch-template-id <launch-template-id> --region us-east-1
```

### Terraform State Management

After cleaning up orphaned resources, refresh the Terraform state:

```bash
# Create a backup of your current state file
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d%H%M%S)

# Refresh the state
terraform refresh

# If needed, remove resources from state that no longer exist
terraform state rm module.eks.aws_eks_cluster.this[0]
terraform state rm module.eks.module.eks_managed_node_group["example"].aws_eks_node_group.this[0]
```

### Solution Implementation

To fix the NodeCreationFailure issue, update your EKS Terraform configuration to ensure the VPC CNI add-on is installed before node groups:

```terraform
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.21.0"

  cluster_name    = "${var.prefix}-${var.environment}-cluster"
  cluster_version = "1.28"

  # Optional
  cluster_endpoint_public_access = true

  vpc_id     = module.eks_network.vpc_id
  subnet_ids = module.eks_network.private_subnets

  # Add VPC CNI add-on with before_compute = true
  cluster_addons = {
    vpc-cni = {
      most_recent    = true
      before_compute = true
    }
    kube-proxy = {
      most_recent = true
    }
    coredns = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    example = {
      ami_type       = "AL2023_x86_64_STANDARD"
      instance_types = ["t3.medium"]

      min_size     = 1
      max_size     = 3
      desired_size = 1

      tags = {
        Environment = var.environment
        Terraform   = "true"
        repo        = "DevOpsDojo"
      }
    }
  }

  tags = {
    Environment = var.environment
    Terraform   = "true"
    repo        = "DevOpsDojo"
  }
}
```

The key change is adding the `cluster_addons` block with `vpc-cni` configured with `before_compute = true`, which ensures the VPC CNI add-on is installed before the node groups are created.

### Best Practices for Preventing Future Issues

1. **Use Remote State Backend**
   Configure a remote backend for Terraform to prevent state file corruption:

   ```terraform
   terraform {
     backend "s3" {
       bucket         = "your-terraform-state-bucket"
       key            = "eks/terraform.tfstate"
       region         = "us-east-1"
       dynamodb_table = "terraform-locks"
       encrypt        = true
     }
   }
   ```

2. **Configure Resource Timeouts**
   Add timeouts to resources to give them more time to create/destroy:

   ```terraform
   module "eks" {
     # ... existing configuration ...
     
     timeouts = {
       create = "30m"
       update = "30m"
       delete = "30m"
     }
   }
   ```

3. **Use Targeted Operations**
   For large infrastructures, use targeted operations to minimize the impact of interruptions:

   ```bash
   # Targeted destroy
   terraform destroy -target=module.eks.module.eks_managed_node_group
   terraform destroy -target=module.eks
   terraform destroy -target=module.eks_network

   # Targeted apply
   terraform apply -target=module.eks_network
   terraform apply -target=module.eks
   terraform apply
   ```

4. **Always Install Add-ons Before Node Groups**
   Ensure that critical add-ons like VPC CNI are installed before node groups by using the `before_compute = true` parameter.

5. **Verify Subnet Tags**
   Ensure subnets have the proper tags for EKS:
   - `kubernetes.io/cluster/<cluster-name>` = "shared" or "owned"
   - `kubernetes.io/role/elb` = "1" for public subnets
   - `kubernetes.io/role/internal-elb` = "1" for private subnets

6. **Check IAM Permissions**
   Ensure node groups have the required IAM policies:
   - `AmazonEKSWorkerNodePolicy`
   - `AmazonEKS_CNI_Policy`
   - `AmazonEC2ContainerRegistryReadOnly`

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
│   └── Policies Present → Check instance logs
├── Check Instance Logs
│   ├── Bootstrap Errors → Fix user data
│   └── No Errors → Check other issues
```

By following this systematic approach, you can identify and resolve EKS node group creation failures efficiently.

## Systematic EKS Cluster Cleanup and Recreation

When you encounter issues with an EKS cluster that can't be easily fixed, a complete cleanup and recreation is often the best approach. Here's a systematic process to ensure all resources are properly cleaned up before recreating the cluster.

### Step 1: Document Current Resources

Before deleting anything, document what resources exist:

```bash
# List all EKS clusters
aws eks list-clusters --region us-east-1

# Document node groups for the cluster
aws eks list-nodegroups --cluster-name bootcamp-dev-cluster --region us-east-1

# Document Fargate profiles if any
aws eks list-fargate-profiles --cluster-name bootcamp-dev-cluster --region us-east-1

# Document add-ons
aws eks list-addons --cluster-name bootcamp-dev-cluster --region us-east-1

# Document all resources with the cluster tag
aws resourcegroupstaggingapi get-resources --tag-filters Key=kubernetes.io/cluster/bootcamp-dev-cluster,Values=owned --region us-east-1
```

### Step 2: Delete Resources in the Correct Order

Delete resources in the reverse order of creation to respect dependencies:

```bash
# 1. Delete all node groups first
for ng in $(aws eks list-nodegroups --cluster-name bootcamp-dev-cluster --region us-east-1 --query 'nodegroups[*]' --output text); do
  echo "Deleting node group: $ng"
  aws eks delete-nodegroup --cluster-name bootcamp-dev-cluster --nodegroup-name $ng --region us-east-1
done

# 2. Delete any Fargate profiles
for profile in $(aws eks list-fargate-profiles --cluster-name bootcamp-dev-cluster --region us-east-1 --query 'fargateProfileNames[*]' --output text); do
  echo "Deleting Fargate profile: $profile"
  aws eks delete-fargate-profile --cluster-name bootcamp-dev-cluster --fargate-profile-name $profile --region us-east-1
done

# 3. Delete add-ons
for addon in $(aws eks list-addons --cluster-name bootcamp-dev-cluster --region us-east-1 --query 'addons[*]' --output text); do
  echo "Deleting add-on: $addon"
  aws eks delete-addon --cluster-name bootcamp-dev-cluster --addon-name $addon --region us-east-1
done

# 4. Delete the EKS cluster itself
echo "Deleting EKS cluster: bootcamp-dev-cluster"
aws eks delete-cluster --name bootcamp-dev-cluster --region us-east-1
```

### Step 3: Wait for Cluster Deletion to Complete

```bash
echo "Waiting for cluster deletion to complete..."
aws eks wait cluster-deleted --name bootcamp-dev-cluster --region us-east-1
echo "Cluster deletion completed"
```

### Step 4: Clean Up Orphaned Resources

After the cluster is deleted, there may still be orphaned resources:

```bash
# Find security groups with the cluster name
SGs=$(aws ec2 describe-security-groups --region us-east-1 --filters "Name=group-name,Values=*bootcamp-dev-cluster*" --query "SecurityGroups[*].GroupId" --output text)

# Find ENIs using these security groups
for sg in $SGs; do
  echo "Checking for ENIs using security group: $sg"
  ENIs=$(aws ec2 describe-network-interfaces --region us-east-1 --filters "Name=group-id,Values=$sg" --query "NetworkInterfaces[*].NetworkInterfaceId" --output text)
  
  # Delete or detach ENIs
  for eni in $ENIs; do
    echo "Found ENI: $eni"
    ATTACHMENT=$(aws ec2 describe-network-interfaces --region us-east-1 --network-interface-ids $eni --query "NetworkInterfaces[0].Attachment.AttachmentId" --output text)
    
    if [ "$ATTACHMENT" != "None" ] && [ "$ATTACHMENT" != "null" ]; then
      echo "Detaching ENI: $eni, Attachment: $ATTACHMENT"
      aws ec2 detach-network-interface --attachment-id $ATTACHMENT --force --region us-east-1
      sleep 10
    fi
    
    echo "Deleting ENI: $eni"
    aws ec2 delete-network-interface --network-interface-id $eni --region us-east-1
  done
  
  # Now try to delete the security group
  echo "Deleting security group: $sg"
  aws ec2 delete-security-group --group-id $sg --region us-east-1
done

# Find and delete IAM roles
ROLES=$(aws iam list-roles --query "Roles[?contains(RoleName, 'bootcamp-dev-cluster')].RoleName" --output text)
for role in $ROLES; do
  echo "Processing IAM role: $role"
  
  # List and detach policies
  POLICIES=$(aws iam list-attached-role-policies --role-name $role --query "AttachedPolicies[*].PolicyArn" --output text)
  for policy in $POLICIES; do
    echo "Detaching policy: $policy from role: $role"
    aws iam detach-role-policy --role-name $role --policy-arn $policy
  done
  
  # Delete the role
  echo "Deleting role: $role"
  aws iam delete-role --role-name $role
done
```

### Step 5: Verify All Resources Are Cleaned Up

```bash
# Verify no EKS clusters remain
aws eks list-clusters --region us-east-1

# Verify no security groups remain
aws ec2 describe-security-groups --region us-east-1 --filters "Name=group-name,Values=*bootcamp-dev-cluster*"

# Verify no IAM roles remain
aws iam list-roles --query "Roles[?contains(RoleName, 'bootcamp-dev-cluster')]"

# Check for any remaining tagged resources
aws resourcegroupstaggingapi get-resources --tag-filters Key=kubernetes.io/cluster/bootcamp-dev-cluster,Values=owned --region us-east-1
```

### Step 6: Recreate the Cluster with Fixed Configuration

Now that all resources are cleaned up, you can recreate the cluster with the correct configuration:

```bash
# Navigate to your Terraform directory
cd infra/

# Initialize Terraform
terraform init

# Apply with the fixed configuration
terraform apply -auto-approve
```

### Key Points to Remember

1. **Delete in the Correct Order**: Always delete node groups and Fargate profiles before deleting the cluster
2. **Wait for Completion**: EKS resource deletion can take time, be patient and verify completion
3. **Check for Orphaned Resources**: After cluster deletion, check for and clean up any orphaned resources
4. **Use Force When Necessary**: For stubborn resources, use force options but be cautious
5. **Verify Complete Cleanup**: Always verify all resources are cleaned up before recreating

This systematic approach ensures a clean slate for your new cluster deployment, avoiding conflicts with orphaned resources from the previous deployment.

### Handling Security Group Dependency Violations

If you encounter a dependency violation when trying to delete a security group:

```
An error occurred (DependencyViolation) when calling the DeleteSecurityGroup operation: resource sg-0d4e430fd0df42d0c has a dependent object
```

Follow these steps to identify and remove the dependencies:

#### Step 1: Identify what's using the security group
```bash
# Check if the security group is referenced by other security groups
aws ec2 describe-security-groups --region us-east-1 --filters "Name=ip-permission.group-id,Values=sg-0d4e430fd0df42d0c"

# Check if any network interfaces are using the security group
aws ec2 describe-network-interfaces --region us-east-1 --filters "Name=group-id,Values=sg-0d4e430fd0df42d0c"
```

#### Step 2: Detach the security group from network interfaces
If network interfaces are using the security group:

```bash
# For each network interface, modify it to use a different security group
# First, get the default security group for the VPC
DEFAULT_SG=$(aws ec2 describe-security-groups --region us-east-1 --filters "Name=vpc-id,Values=vpc-02a2adcd3e9d505c8" "Name=group-name,Values=default" --query "SecurityGroups[0].GroupId" --output text)

# Then modify each network interface
aws ec2 modify-network-interface-attribute --region us-east-1 --network-interface-id <eni-id> --groups $DEFAULT_SG
```

#### Step 3: Check for ENIs in "available" state
Sometimes there are orphaned ENIs in "available" state that still reference the security group:

```bash
# Find available ENIs using the security group
aws ec2 describe-network-interfaces --region us-east-1 --filters "Name=group-id,Values=sg-0d4e430fd0df42d0c" "Name=status,Values=available" --query "NetworkInterfaces[*].NetworkInterfaceId"

# Delete these ENIs
aws ec2 delete-network-interface --region us-east-1 --network-interface-id <eni-id>
```

#### Step 4: Check for other resources
Other resources that might reference security groups include:
- Load balancers
- Launch configurations
- Launch templates
- Auto scaling groups

```bash
# Check for load balancers using the security group
aws elbv2 describe-load-balancers --region us-east-1 --query "LoadBalancers[?SecurityGroups[?contains(@, 'sg-0d4e430fd0df42d0c')]]"

# Check for auto scaling groups
aws autoscaling describe-auto-scaling-groups --region us-east-1
```

#### Step 5: Try deleting again
After removing all dependencies, try deleting the security group again:

```bash
aws ec2 delete-security-group --group-id sg-0d4e430fd0df42d0c --region us-east-1
```

### Cleaning Up IAM Roles

For IAM roles like `bootcamp-dev-cluster-cluster-20250706172652958900000001`, follow these steps:

#### Step 1: List attached policies
```bash
aws iam list-attached-role-policies --role-name bootcamp-dev-cluster-cluster-20250706172652958900000001
```

#### Step 2: Detach each policy
```bash
# For each policy ARN returned above
aws iam detach-role-policy --role-name bootcamp-dev-cluster-cluster-20250706172652958900000001 --policy-arn <policy-arn>
```

#### Step 3: Delete the role
```bash
aws iam delete-role --role-name bootcamp-dev-cluster-cluster-20250706172652958900000001
```

### Handling Stubborn Resources with AWS Resource Groups

If you have many resources to clean up, AWS Resource Groups can help:

```bash
# Create a tag-based resource group for all resources with the cluster tag
aws resourcegroupstaggingapi get-resources --tag-filters Key=kubernetes.io/cluster/bootcamp-dev-cluster,Values=owned --region us-east-1
```

This will list all resources with the specified tag, making it easier to identify what needs to be cleaned up.

### Using AWS CloudFormation to Find Stack Resources

If the EKS cluster was created as part of a CloudFormation stack:

```bash
# List stacks
aws cloudformation list-stacks --region us-east-1 --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Describe resources in a specific stack
aws cloudformation list-stack-resources --stack-name <stack-name> --region us-east-1
```

### Force-Detaching ENIs from Instances

In some cases, you may need to force-detach ENIs:

```bash
# Force detach an ENI
aws ec2 detach-network-interface --region us-east-1 --attachment-id <attachment-id> --force
```

### Terraform Import for Orphaned Resources

If you need to bring orphaned resources under Terraform management:

```bash
# Import a security group
terraform import module.eks.aws_security_group.node[0] sg-0d4e430fd0df42d0c

# Import an IAM role
terraform import module.eks.aws_iam_role.cluster[0] bootcamp-dev-cluster-cluster-20250706172652958900000001
```

After importing, you can use Terraform to properly manage and delete these resources.

## Using Terraform Destroy for Cleanup

After manually cleaning up orphaned resources, using `terraform destroy` is a good approach to ensure all Terraform-managed resources are properly removed. Here's how to handle this process:

### Step 1: Run Terraform Destroy

```bash
# Navigate to your Terraform directory
cd infra/

# Run terraform destroy
terraform destroy
```

During the destroy process, you might encounter errors related to resources that:
1. No longer exist (already manually deleted)
2. Have dependencies that prevent deletion
3. Are in an inconsistent state

### Step 2: Handle Terraform State for Missing Resources

If Terraform tries to destroy resources that no longer exist, you'll need to remove them from the state:

```bash
# For resources that no longer exist and cause errors
terraform state rm module.eks.aws_eks_cluster.this[0]
terraform state rm module.eks.module.eks_managed_node_group["example"].aws_eks_node_group.this[0]
# Add other resources as needed
```

### Step 3: Run Targeted Destroy for Problematic Resources

If certain resources have dependencies or are causing issues:

```bash
# Destroy specific resources first
terraform destroy -target=module.eks.module.eks_managed_node_group["example"]
terraform destroy -target=module.eks.aws_eks_cluster.this[0]
terraform destroy -target=module.eks_network
```

### Step 4: Verify Cleanup After Terraform Destroy

After `terraform destroy` completes successfully, verify that all resources have been removed:

```bash
# Check for any remaining resources with the cluster tag
aws resourcegroupstaggingapi get-resources --tag-filters Key=kubernetes.io/cluster/bootcamp-dev-cluster,Values=owned --region us-east-1

# Check for any security groups with the cluster name
aws ec2 describe-security-groups --region us-east-1 --filters "Name=group-name,Values=*bootcamp-dev-cluster*"

# Check for any IAM roles with the cluster name
aws iam list-roles --query "Roles[?contains(RoleName, 'bootcamp-dev-cluster')]"
```

### Step 5: Manual Cleanup of Any Remaining Resources

If any resources remain after `terraform destroy`, you'll need to clean them up manually using the AWS CLI commands provided earlier in this document.

### Step 6: Prepare for Clean Deployment

Once all resources are cleaned up, you can prepare for a clean deployment:

1. Make sure your Terraform configuration includes the necessary add-ons:
   ```terraform
   cluster_addons = {
     vpc-cni = {
       most_recent    = true
       before_compute = true
     }
     kube-proxy = {
       most_recent = true
     }
     coredns = {
       most_recent = true
     }
   }
   ```

2. Initialize and apply your Terraform configuration:
   ```bash
   terraform init
   terraform apply
   ```

### Important Notes for Terraform Destroy

1. **State File Consistency**: If your Terraform state is inconsistent with the actual resources, you may need to use `terraform refresh` before attempting to destroy.

2. **Dependency Order**: Terraform automatically handles dependencies during destroy, but in complex scenarios, you might need to use targeted destroys in the correct order.

3. **Timeout Settings**: For resources that take a long time to delete, consider adding timeout settings in your Terraform configuration:
   ```terraform
   timeouts {
     delete = "30m"
   }
   ```

4. **Force Destroy**: For certain resources like S3 buckets with content, you might need to set `force_destroy = true` in your configuration.

5. **Backup State**: Always create a backup of your Terraform state before making significant changes:
   ```bash
   cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d%H%M%S)
   ```

By combining manual cleanup with `terraform destroy`, you can ensure a thorough cleanup of all resources before recreating your infrastructure with the correct configuration.

## AWS Secrets Manager Troubleshooting

### Issue: Secret Already Scheduled for Deletion

When running Terraform to create a new secret, you may encounter this error:

```
Error: creating Secrets Manager Secret: InvalidRequestException: You can't create this secret because a secret with this name is already scheduled for deletion.
```

#### Root Cause
AWS Secrets Manager keeps deleted secrets for a recovery period (typically 7-30 days by default) before permanently removing them. During this period, you cannot create a new secret with the same name.

#### Verification Steps

To check if a secret exists and its deletion status:

```bash
# List all secrets
aws secretsmanager list-secrets --region us-east-1

# Describe specific secret
aws secretsmanager describe-secret --secret-id db/bootcamp-dev-db --region us-east-1
```

#### Solution Options

1. **Force Delete the Secret Without Recovery Period**:
   ```bash
   aws secretsmanager delete-secret --secret-id db/bootcamp-dev-db --force-delete-without-recovery --region us-east-1
   ```

2. **Use a Different Secret Name in Terraform**:
   ```terraform
   resource "aws_secretsmanager_secret" "db_link" {
     name = "db/${var.prefix}-${var.environment}-db-new"
     # Other configuration...
   }
   ```

3. **Set Zero Recovery Window in Terraform**:
   ```terraform
   resource "aws_secretsmanager_secret" "db_link" {
     name = "db/${var.prefix}-${var.environment}-db"
     recovery_window_in_days = 0
     # Other configuration...
   }
   ```

#### Prevention Strategies

1. **Always Set `recovery_window_in_days = 0` for Development Environments**:
   ```terraform
   resource "aws_secretsmanager_secret" "db_link" {
     name = "db/${var.prefix}-${var.environment}-db"
     recovery_window_in_days = var.environment == "dev" ? 0 : 7
     # Other configuration...
   }
   ```

2. **Use Unique Names with Timestamps or Random Suffixes**:
   ```terraform
   resource "random_id" "suffix" {
     byte_length = 8
   }

   resource "aws_secretsmanager_secret" "db_link" {
     name = "db/${var.prefix}-${var.environment}-db-${random_id.suffix.hex}"
     # Other configuration...
   }
   ```

3. **Implement Proper Terraform State Management**:
   - Use remote state with locking
   - Perform targeted destroys when needed
   - Back up state before major operations

## Troubleshooting IAM Service Account Issues

### Issue Summary
When setting up the AWS Load Balancer Controller, you may encounter issues with the IAM service account creation. The common symptoms include:

1. Error messages indicating that resources already exist
2. eksctl excluding service accounts that don't actually exist in Kubernetes
3. Conflicts between eksctl's internal state and the actual state in Kubernetes

### Root Cause Analysis
This issue typically occurs when:
- Previous attempts to create resources were partially successful
- Resources were deleted outside of the normal workflow
- There's a mismatch between eksctl's tracking system and the actual state in Kubernetes

### Step-by-Step Resolution

#### Step 1: Identify the Issue
First, check if the IAM policy already exists:
```bash
aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam-policy.json
```

If you see an error like `An error occurred (EntityAlreadyExists)`, the policy already exists.

Next, try to create the service account:
```bash
eksctl create iamserviceaccount \
  --cluster=bootcamp-dev-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
  --approve
```

If eksctl reports that the service account will be excluded, check if it actually exists in Kubernetes:
```bash
kubectl get serviceaccount -n kube-system aws-load-balancer-controller
```

#### Step 2: Clean Up Inconsistent State
If the service account doesn't exist in Kubernetes but eksctl thinks it does, delete it from eksctl's tracking:
```bash
eksctl delete iamserviceaccount \
  --cluster=bootcamp-dev-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller
```

#### Step 3: Recreate the Service Account
After cleaning up, recreate the service account:
```bash
eksctl create iamserviceaccount \
  --cluster=bootcamp-dev-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
  --approve
```

#### Step 4: Verify the Service Account
Confirm that the service account was created successfully:
```bash
kubectl get serviceaccount -n kube-system aws-load-balancer-controller
```

#### Step 5: Continue with Helm Installation
Once the service account is properly created, proceed with the Helm installation:
```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=bootcamp-dev-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### Alternative Approaches

#### Manual Service Account Creation
If eksctl continues to give issues, you can create the service account directly with kubectl:
```bash
# Get the IAM role ARN
ROLE_ARN=$(aws iam get-role --role-name AmazonEKSLoadBalancerControllerRole --query Role.Arn --output text)

# Create the service account directly
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aws-load-balancer-controller
  namespace: kube-system
  annotations:
    eks.amazonaws.com/role-arn: $ROLE_ARN
EOF
```

#### Handling Attached IAM Policies
If you need to delete an IAM role but get a "DeleteConflict" error because policies are attached:
```bash
# List attached policies
aws iam list-attached-role-policies --role-name AmazonEKSLoadBalancerControllerRole

# Detach each policy
aws iam detach-role-policy \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy

# Then delete the role
aws iam delete-role --role-name AmazonEKSLoadBalancerControllerRole
```

### Key Learnings
1. Always check both the AWS resources and Kubernetes resources when troubleshooting
2. eksctl maintains its own state that can become inconsistent with the actual cluster state
3. Deleting and recreating resources can resolve state inconsistencies
4. For persistent issues, consider creating resources directly with kubectl and AWS CLI

## RDS Security Group Configuration

### Issue Summary
When setting up RDS instances for EKS applications, you may notice security groups configured with overly permissive inbound rules (e.g., allowing access from `0.0.0.0/0` on port 5432).

### Security Considerations

#### Development/Testing Environments
For development or testing environments, having broader access rules may be acceptable if:
- The RDS instance is in a private subnet without a route to the internet
- The environment is temporary or for testing purposes only
- You need to troubleshoot connectivity issues

#### Production Environments
For production environments, it's critical to follow the principle of least privilege:

1. **Restrict access to specific security groups**:
   ```bash
   # Remove overly permissive rule
   aws ec2 revoke-security-group-ingress \
     --group-id $RDS_SG \
     --protocol tcp \
     --port 5432 \
     --cidr 0.0.0.0/0
   
   # Add more restrictive rule
   aws ec2 authorize-security-group-ingress \
     --group-id $RDS_SG \
     --protocol tcp \
     --port 5432 \
     --source-group $NODE_SG
   ```

2. **Use security group chaining**: Allow access only from the EKS cluster's security group or specific application security groups.

3. **Implement network ACLs**: Add an additional layer of network security with restrictive NACLs on the database subnet.

### Verification Steps

To verify your RDS security group configuration:

```bash
# Get the RDS security group ID
RDS_SG=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*rds*" \
  "Name=vpc-id,Values=$(aws eks describe-cluster --name your-cluster --region your-region --query "cluster.resourcesVpcConfig.vpcId" --output text)" \
  --query "SecurityGroups[0].GroupId" \
  --output text)

# Check the inbound rules
aws ec2 describe-security-groups \
  --group-ids $RDS_SG \
  --query "SecurityGroups[0].IpPermissions"
```

### Best Practices

1. **Defense in Depth**: Even for non-production environments, implement multiple layers of security:
   - Private subnets for database instances
   - Restrictive security groups
   - Network ACLs as appropriate

2. **Regular Audits**: Periodically review security group configurations to ensure they haven't been inadvertently modified.

3. **Infrastructure as Code**: Define security groups using Terraform or CloudFormation to ensure consistent configuration and prevent drift.

4. **Documentation**: Clearly document any intentional deviations from best practices in non-production environments.

### Balancing Security and Convenience

While strict security is always recommended, there are legitimate cases where broader access rules in non-production environments can facilitate development and troubleshooting:

- When multiple developers need to access the database from different locations
- When integrating with external tools or services during development
- When troubleshooting connectivity issues

In these cases, ensure that:
1. The broader access is limited to non-production environments
2. The database contains no sensitive or production data
3. Strong authentication is still enforced (complex passwords, IAM authentication)
4. The configuration is documented and understood as a deviation from best practices

## RDS Connectivity Issues from EKS

### Issue Summary
After successfully deploying the EKS cluster and RDS database, applications running in the EKS cluster were unable to connect to the RDS database. The security group for the RDS instance was configured to allow traffic from any IP address (`0.0.0.0/0`) on port 5432, but this wasn't sufficient for establishing a secure and reliable connection from the EKS pods to the RDS instance.

### Root Cause Analysis
The root cause of the connectivity issue was a combination of factors:

1. **Security Group Configuration**: While the RDS security group allowed inbound traffic from any IP address (`0.0.0.0/0`), this is not a recommended security practice. More importantly, it didn't explicitly allow traffic from the EKS cluster's security group.

2. **Network Path**: Even though the RDS instance was in a private subnet and the security group allowed traffic from anywhere, the network path between EKS pods and the RDS instance wasn't properly established.

3. **DNS Resolution**: The Kubernetes service for the database needed to be properly configured to resolve to the RDS endpoint.

4. **Credentials Management**: The database credentials weren't properly accessible to the application pods.

### Troubleshooting Process

#### Step 1: Identify the EKS Cluster Security Group
First, we identified the security group associated with the EKS cluster:

```bash
# Get the EKS cluster security group ID
NODE_SG=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.securityGroupIds[0]" --output text)
echo "EKS Node Security Group: $NODE_SG"
```

This command retrieves the security group ID associated with the EKS cluster and stores it in the `NODE_SG` variable.

#### Step 2: Examine the RDS Security Group Configuration
Next, we examined the current configuration of the RDS security group:

```bash
# Check the current inbound rules for the RDS security group
aws ec2 describe-security-groups --group-ids sg-028044234144db4c1 --region us-east-1 --query "SecurityGroups[0].IpPermissions"
```

The output showed that the RDS security group allowed inbound traffic from any IP address (`0.0.0.0/0`) on port 5432, which is not a secure configuration for a production environment.

#### Step 3: Update the RDS Security Group
We added a rule to allow traffic specifically from the EKS cluster's security group:

```bash
# Allow traffic from EKS nodes to RDS
aws ec2 authorize-security-group-ingress \
  --group-id sg-028044234144db4c1 \
  --protocol tcp \
  --port 5432 \
  --source-group $NODE_SG \
  --region us-east-1
```

This command adds a rule to the RDS security group to allow inbound traffic on port 5432 (PostgreSQL) from the EKS cluster's security group.

#### Step 4: Verify DNS Resolution
We created a test pod to verify that the Kubernetes service for the database correctly resolves to the RDS endpoint:

```bash
# Test DNS resolution
kubectl run -it --rm --restart=Never dns-test --image=tutum/dnsutils -- dig postgres-db.3-tier-app-eks.svc.cluster.local
```

The output confirmed that `postgres-db.3-tier-app-eks.svc.cluster.local` correctly resolved to the RDS endpoint `bootcamp-dev-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com` with IP `10.0.6.6`.

#### Step 5: Test Database Connectivity
We created a debug pod to test the connection to the database:

```bash
# Create a debug pod
kubectl run debug-pod --rm -it --image=postgres:13 -n 3-tier-app-eks -- bash

# Inside the pod, test the connection
PGPASSWORD=dJQZZryLLi psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U postgres -d postgres
```

Initially, we attempted to connect to the wrong endpoint. After retrieving the correct credentials from AWS Secrets Manager, we were able to connect successfully.

#### Step 6: Retrieve Database Credentials
We retrieved the database credentials from AWS Secrets Manager:

```bash
# Get the secret value
aws secretsmanager get-secret-value --secret-id db/bootcamp-dev-db --region us-east-1 --query SecretString --output text
```

The output provided the connection string with the password:
```
postgresql://postgres:dJQZZryLLi@bootcamp-dev-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com:5432/postgres
```

### Solution Implementation

#### Step 1: Update Security Group Configuration
We modified the RDS security group to allow traffic specifically from the EKS cluster's security group:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-028044234144db4c1 \
  --protocol tcp \
  --port 5432 \
  --source-group $NODE_SG \
  --region us-east-1
```

#### Step 2: Update Kubernetes Secrets
We updated the Kubernetes secrets with the correct database credentials:

```bash
# Generate base64 encoded values
echo -n 'bootcamp-dev-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com' | base64  # DB_HOST
echo -n 'postgres' | base64  # DB_NAME and DB_USER
echo -n 'dJQZZryLLi' | base64  # DB_PASSWORD
echo -n 'postgresql://postgres:dJQZZryLLi@bootcamp-dev-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com:5432/postgres' | base64  # DATABASE_URL

# Update the secrets.yaml file with these values
kubectl apply -f secrets.yaml
```

#### Step 3: Update Database Service
We ensured the Kubernetes service for the database was correctly configured:

```bash
kubectl apply -f database-service.yaml
```

### Verification Steps

#### Step 1: Verify DNS Resolution
We verified that the Kubernetes service correctly resolves to the RDS endpoint:

```bash
kubectl run -it --rm --restart=Never dns-test --image=tutum/dnsutils -- dig postgres-db.3-tier-app-eks.svc.cluster.local
```

#### Step 2: Verify Database Connectivity
We verified that we could connect to the database from a pod in the EKS cluster:

```bash
kubectl run debug-pod --rm -it --image=postgres:13 -n 3-tier-app-eks -- bash
# Inside the pod
PGPASSWORD=dJQZZryLLi psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U postgres -d postgres
# Test query: SELECT version();
```

The successful connection confirmed that the issue was resolved.

### Key Learnings

1. **Security Group Best Practices**: 
   - Always follow the principle of least privilege when configuring security groups
   - Use security group references instead of CIDR blocks when possible
   - Avoid using `0.0.0.0/0` for database access

2. **Kubernetes Service Configuration**:
   - Properly configure Kubernetes services to point to external resources
   - Use ExternalName services for RDS instances

3. **Secrets Management**:
   - Store database credentials in AWS Secrets Manager
   - Use Kubernetes secrets to make credentials available to pods
   - Ensure secrets are properly encoded and updated

4. **Systematic Troubleshooting Approach**:
   - Identify the network path
   - Check security group configurations
   - Verify DNS resolution
   - Test connectivity with debug pods
   - Retrieve and verify credentials

5. **Documentation**:
   - Document the troubleshooting process
   - Document the solution for future reference
   - Update runbooks with lessons learned

## Troubleshooting RDS Connectivity Issues in EKS

### RDS Connectivity Issue Summary

When deploying the 3-tier application on EKS, the database migration job failed with a `CreateContainerConfigError`. The job was unable to start because it couldn't find required environment variables in the Kubernetes Secret. This prevented the application from initializing the database schema and connecting to the RDS instance.

**Error Message:**
```
Error: couldn't find key DATABASE_URL in Secret 3-tier-app-eks/db-secrets
```

### RDS Connectivity Root Cause

The root cause analysis revealed multiple configuration issues:

1. **Incomplete Secret Configuration**: The `db-secrets` Secret was missing critical keys:
   - `DATABASE_URL` - Required for the migration job to connect to the database
   - `SECRET_KEY` - Required for Flask application security
   - `DB_PASSWORD` - Required for database authentication

2. **Conflicting Database Host Configuration**: 
   - The ConfigMap defined `DB_HOST` as `postgres-db.3-tier-app-eks.svc.cluster.local` (Kubernetes service)
   - The Secret defined `DB_HOST` as the actual RDS endpoint
   - This conflict could cause applications to attempt connecting to different endpoints

3. **Environment Variable Reference Issues**:
   - The migration job was referencing `DB_USERNAME` but the Secret contained `DB_USER`
   - This naming mismatch prevented the container from starting

### RDS Connectivity Verification Steps

To diagnose the issue, the following verification steps were performed:

```bash
# Check the pod status to identify the specific error
kubectl describe pod -n 3-tier-app-eks -l job-name=database-migration

# Examine the ConfigMap to verify its contents
kubectl get configmap app-config -n 3-tier-app-eks -o yaml

# Examine the Secret to verify its contents
kubectl get secret db-secrets -n 3-tier-app-eks -o yaml
```

The pod description revealed the specific error message:
```
Error: couldn't find key DATABASE_URL in Secret 3-tier-app-eks/db-secrets
```

Examining the Secret confirmed it was missing the required keys:
```yaml
apiVersion: v1
data:
  DB_HOST: Ym9vdGNhbXAtZGV2LWRiLmM2dDRxMGc2aTRuNS51cy1lYXN0LTEucmRzLmFtYXpvbmF3cy5jb20=
  DB_NAME: cG9zdGdyZXM=
  DB_USER: cG9zdGdyZXM=
kind: Secret
metadata:
  # ... metadata omitted ...
type: Opaque
```

### RDS Connectivity Solution

The solution involved a systematic approach to fix the configuration issues:

#### Step 1: Update the Secret with Missing Keys

```bash
# Create a temporary file with the updated Secret definition
cat <<EOF > updated-secrets.yaml
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
```

## Database Migration Troubleshooting in EKS

### Issue Summary
When deploying a multi-tier application on EKS, database migration jobs may fail with errors related to Alembic migrations. Common symptoms include:

- Migration job pods failing with `ERROR [alembic.runtime.migration] Can't locate revision identified by '...'`
- Database tables not being created properly
- Application pods unable to connect to database tables
- Repeated migration failures even after redeployment

### Root Cause Analysis

The primary causes of migration failures in EKS deployments are:

1. **Inconsistent Migration State**: The Alembic version table in the database contains references to migration versions that don't exist in the application code.
2. **Corrupted Migration History**: Previous failed migrations leave the database in an inconsistent state.
3. **Environment Variable Issues**: Missing or incorrect environment variables prevent the migration job from connecting to the database.
4. **Database Connectivity**: Network or security group issues preventing the migration pod from reaching the database.

### Systematic Troubleshooting Approach

#### Step 1: Verify Migration Job Status and Logs
```bash
# Check migration job status
kubectl get jobs -n <namespace>

# Check migration job logs
kubectl logs job/<migration-job-name> -n <namespace>
```

#### Step 2: Check Database Connectivity
```bash
# Create a debug pod to test database connectivity
kubectl run db-test --rm -it --image=postgres:13 -n <namespace> -- bash

# Inside the pod, test connection to the database
PGPASSWORD=<password> psql -h <db-host> -U <username> -d <db-name>

# Check if the alembic_version table exists
\dt alembic_version
SELECT * FROM alembic_version;
```

## Ingress Deployment Troubleshooting in EKS

### Issue Summary
When deploying applications on EKS, a common issue is that the ingress resource doesn't create an Application Load Balancer (ALB), or the ALB is created but doesn't route traffic correctly. This prevents external access to applications running in the cluster.

### Root Cause Analysis
The most common causes of ingress/ALB issues in EKS are:

1. **Missing or Incorrect Subnet Tags**: AWS Load Balancer Controller requires specific subnet tags to identify where to create ALBs.
2. **AWS Load Balancer Controller Not Installed/Configured**: The controller is required to provision ALBs based on ingress resources.
3. **IAM Permissions Issues**: The controller needs specific IAM permissions to create AWS resources.
4. **Ingress Resource Misconfiguration**: Incorrect annotations, backend service references, or port specifications.
5. **Security Group Restrictions**: Security groups may block traffic to the ALB or from the ALB to the pods.

### Systematic Troubleshooting Approach

#### Step 1: Verify Ingress Resource Status
```bash
# Check if ingress exists
kubectl get ingress -n 3-tier-app-eks
```

## Troubleshooting EKS Monitoring Setup Issues

### Issue Summary
When deploying Prometheus and Grafana monitoring on EKS, several common issues can prevent proper functioning:

1. **Persistent Volume Claims (PVCs) stuck in Pending state**
2. **Missing or misconfigured EBS CSI Driver**
3. **AWS Load Balancer Controller not creating ALBs for ingress resources**
4. **Monitoring pods failing to start or reach Ready state**

These issues prevent the monitoring stack from functioning correctly and block access to metrics and dashboards.

### Root Cause Analysis

#### 1. PVCs Stuck in Pending State
**Root Cause**: The EBS CSI Driver is either not installed or not properly configured in the EKS cluster. This driver is required for dynamic provisioning of EBS volumes for Prometheus and Grafana persistent storage.

**Verification Steps**:
```bash
# Check if PVCs are stuck in Pending
kubectl get pvc -n monitoring

# Check if any PVs are being created
kubectl get pv

# Check EBS CSI driver status
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

#### 2. AWS Load Balancer Controller Issues
**Root Cause**: The AWS Load Balancer Controller is either not installed, not properly configured, or lacks the necessary permissions to create ALBs. Additionally, subnet tagging might be incorrect.

**Verification Steps**:
```bash
# Check if AWS Load Balancer Controller is running
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# Check controller logs for errors
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# Check if ingress resources are properly configured
kubectl get ingress -n monitoring
kubectl describe ingress monitoring-ingress -n monitoring
```

#### 3. Subnet Tagging Issues
**Root Cause**: Subnets used by the EKS cluster lack the required tags for the ALB controller to identify which subnets to use for load balancer creation.

**Verification Steps**:
```bash
# Get subnet IDs used by your EKS cluster
aws eks describe-cluster --name <cluster-name> --query "cluster.resourcesVpcConfig.subnetIds" --output text

# Check tags on these subnets
aws ec2 describe-subnets --subnet-ids <subnet-id> --query "Subnets[0].Tags" --output json
```

### Solution Implementation

#### Step 1: Install or Fix EBS CSI Driver

```bash
# Check if EBS CSI driver is installed
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver

# If not installed or not working, install it using eksctl
eksctl create addon --name aws-ebs-csi-driver --cluster <cluster-name> --region <region>

# Alternatively, install using Helm
helm repo add aws-ebs-csi-driver https://kubernetes-sigs.github.io/aws-ebs-csi-driver
helm repo update
helm upgrade --install aws-ebs-csi-driver \
  --namespace kube-system \
  aws-ebs-csi-driver/aws-ebs-csi-driver
```

#### Step 2: Fix Subnet Tagging for ALB Controller

```bash
# Tag public subnets for external-facing load balancers
aws ec2 create-tags \
  --resources <public-subnet-id> \
  --tags Key=kubernetes.io/role/elb,Value=1 \
  --region <region>

# Tag private subnets for internal load balancers
aws ec2 create-tags \
  --resources <private-subnet-id> \
  --tags Key=kubernetes.io/role/internal-elb,Value=1 \
  --region <region>
```

#### Step 3: Install or Fix AWS Load Balancer Controller

```bash
# Check if controller is installed
kubectl get deployment -n kube-system aws-load-balancer-controller

# If not installed, install it using Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=<cluster-name> \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

#### Step 4: Create Basic Auth Secret for Ingress

```bash
# Create auth file with username and password
htpasswd -c auth admin

# Create Kubernetes secret from this file
kubectl create secret generic monitoring-basic-auth \
  --from-file=auth \
  -n monitoring
```

#### Step 5: Apply Monitoring Resources

```bash
# Apply the monitoring ingress
kubectl apply -f monitoring-ingress.yaml

# Check ingress status
kubectl get ingress -n monitoring

# Check if ALB is created (may take a few minutes)
aws elbv2 describe-load-balancers --query "LoadBalancers[].DNSName" --output text
```

### Troubleshooting Decision Tree

```
Monitoring Setup Issues
├── PVCs Stuck in Pending
│   ├── EBS CSI Driver Missing → Install EBS CSI Driver
│   ├── EBS CSI Driver Installed but not working → Check IAM permissions
│   └── Storage Class Issues → Verify gp2 storage class exists
├── Ingress Not Creating ALB
│   ├── ALB Controller Missing → Install ALB Controller
│   ├── ALB Controller Running → Check logs for errors
│   ├── Subnet Tags Missing → Add required tags
│   └── IAM Permissions → Verify ALB Controller IAM role
├── Prometheus/Grafana Pods Not Starting
│   ├── PVC Issues → Fix storage provisioning
│   ├── Resource Constraints → Check node resources
│   └── Configuration Errors → Check Helm values
```

### Key Learnings and Best Practices

1. **Always verify EBS CSI Driver installation** before deploying applications that require persistent storage.

2. **Properly tag subnets** for EKS resources:
   - `kubernetes.io/cluster/<cluster-name>` = "shared" or "owned"
   - `kubernetes.io/role/elb` = "1" for public subnets
   - `kubernetes.io/role/internal-elb` = "1" for private subnets

3. **Check IAM permissions** for service accounts:
   - EBS CSI Driver needs permissions to create/attach EBS volumes
   - ALB Controller needs permissions to create/manage load balancers

4. **Use Helm for complex deployments** like Prometheus and Grafana to ensure proper configuration.

5. **Implement proper security** for monitoring dashboards using basic auth or other authentication methods.

6. **Verify all components** in the monitoring stack are working together:
   - Storage provisioning (EBS CSI Driver)
   - Network access (ALB Controller)
   - Application configuration (Prometheus/Grafana)

By following these troubleshooting steps and best practices, you can successfully deploy and maintain a monitoring stack on your EKS cluster.
# Get detailed information about the ingress
kubectl describe ingress 3-tier-app-ingress -n 3-tier-app-eks
```

Look for events and status information that might indicate why the ALB isn't being created.

#### Step 2: Verify AWS Load Balancer Controller Installation
```bash
# Check if the controller is running
kubectl get deployment -n kube-system aws-load-balancer-controller

# Check controller logs for errors
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=50
```

The controller should be in a "Running" state with all pods ready.

#### Step 3: Check Subnet Tags
The AWS Load Balancer Controller requires specific tags on subnets:
- Public subnets: `kubernetes.io/role/elb=1`
- Private subnets: `kubernetes.io/role/internal-elb=1`

```bash
# Get VPC ID
VPC_ID=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)

# Check subnet tags
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].{SubnetId:SubnetId,Tags:Tags}' --region us-east-1

# Add missing tags to public subnets
PUBLIC_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=true" --query "Subnets[*].SubnetId" --output text --region us-east-1)

for subnet in $PUBLIC_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/elb,Value=1 --region us-east-1
done
```

#### Step 4: Verify IAM Permissions
The AWS Load Balancer Controller requires specific IAM permissions to create and manage ALBs.

```bash
# Check if the IAM service account exists
kubectl get serviceaccount -n kube-system aws-load-balancer-controller

# Verify the IAM role attached to the service account
eksctl get iamserviceaccount --cluster bootcamp-dev-cluster --region us-east-1
```

#### Step 5: Check Backend Services
Ensure the services referenced in the ingress exist and are properly configured:

```bash
# Check if backend services exist
kubectl get svc -n 3-tier-app-eks

# Verify service endpoints
kubectl get endpoints -n 3-tier-app-eks
```

#### Step 6: Force Recreate Ingress Resource
If the ingress is stuck in a bad state, you may need to force delete and recreate it:

```bash
# Force delete stuck ingress
kubectl patch ingress 3-tier-app-ingress -n 3-tier-app-eks -p '{"metadata":{"finalizers":[]}}' --type=merge
kubectl delete ingress 3-tier-app-ingress -n 3-tier-app-eks --grace-period=0 --force

# Recreate ingress
kubectl apply -f ingress.yaml
```

#### Step 7: Verify ALB Creation in AWS Console
Check if the ALB was created in the AWS console:

```bash
# Get ALBs in your account
aws elbv2 describe-load-balancers --region us-east-1

# Check target groups
aws elbv2 describe-target-groups --region us-east-1
```

#### Step 8: Test Connectivity
Once the ALB is created, test connectivity:

```bash
# Get the ALB DNS name
ALB_DNS=$(kubectl get ingress 3-tier-app-ingress -n 3-tier-app-eks -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test connectivity
curl -I http://$ALB_DNS
```

### Sample Ingress Resource
Here's a properly configured ingress resource for the AWS Load Balancer Controller:

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: alb
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
  ingressClassName: alb
  rules:
  - http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
## Troubleshooting Stuck Ingress Resources

### Issue Summary
When attempting to delete ingress resources during cluster cleanup, you may encounter situations where the ingress remains stuck in a "Terminating" state. This commonly occurs when:

1. The IngressClass resource is deleted before the ingress resources that depend on it
2. The AWS Load Balancer Controller's admission webhook blocks deletion due to missing dependencies
3. Finalizers prevent the Kubernetes API from completing the resource deletion

### Root Cause Analysis
The primary causes for stuck ingress resources include:

1. **Webhook Validation Failures**: The AWS Load Balancer Controller includes an admission webhook that validates ingress resources. When the referenced IngressClass is missing, the webhook prevents modifications to the ingress.

2. **Resource Finalizers**: The ingress has a finalizer (`ingress.k8s.aws/resources`) that instructs Kubernetes to wait for the controller to clean up associated AWS resources before completing deletion.

3. **Dependency Order**: Deleting the IngressClass before dependent ingress resources creates a deadlock - the ingress can't be modified because the IngressClass is gone, but it can't be deleted because the finalizer is still present.

### Verification Steps

To verify this issue, check the status of the ingress and any error messages:

```bash
# Check if ingress is stuck in Terminating state
kubectl get ingress -n <namespace>

# Describe the ingress to see events and conditions
kubectl describe ingress <ingress-name> -n <namespace>

# Check AWS Load Balancer Controller logs for errors
kubectl logs -n kube-system deployment/aws-load-balancer-controller
```

Common error messages include:
- `admission webhook "vingress.elbv2.k8s.aws" denied the request: invalid ingress class: IngressClass.networking.k8s.io "alb" not found`
- Resource remains in "Terminating" state for an extended period

### Solution Implementation

#### Step 1: Check AWS Load Balancer Controller Status

First, verify if the controller is running:

```bash
kubectl get pods -n kube-system | grep aws-load-balancer-controller
```

#### Step 2: Temporarily Disable the Webhook (if needed)

If the webhook is preventing deletion:

```bash
# Get the webhook configuration
kubectl get validatingwebhookconfigurations

# Temporarily disable the webhook by patching it
kubectl patch validatingwebhookconfiguration aws-load-balancer-webhook \
  --type='json' \
  -p='[{"op": "replace", "path": "/webhooks/0/failurePolicy", "value": "Ignore"}]'
```

#### Step 3: Remove Finalizers from the Ingress Resource

Edit the ingress resource to remove finalizers:

```bash
# Option 1: Use kubectl patch
kubectl patch ingress <ingress-name> -n <namespace> -p '{"metadata":{"finalizers":[]}}' --type=merge

# Option 2: Edit the resource directly
kubectl edit ingress <ingress-name> -n <namespace>
```

When editing directly, remove the following section:
```yaml
finalizers:
- ingress.k8s.aws/resources
```

#### Step 4: Force Delete the Resource

If the resource is still stuck, force delete it:

```bash
kubectl delete ingress <ingress-name> -n <namespace> --grace-period=0 --force
```

#### Step 5: Recreate IngressClass (if needed)

If the above steps don't work, temporarily recreate the IngressClass:

```bash
# Create a temporary IngressClass
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: alb
spec:
  controller: ingress.k8s.aws/alb
EOF

# Try deleting the ingress again
kubectl delete ingress <ingress-name> -n <namespace>

# Expected success output:
# ingress.networking.k8s.io "<ingress-name>" deleted

# If you get "Error from server (NotFound)", the ingress is already deleted ✅
```

#### Step 5.1: Verify Ingress Deletion and Cleanup Temporary IngressClass

After successfully deleting the ingress, clean up the temporary IngressClass:

```bash
# Verify the ingress is completely gone
kubectl get ingress -n <namespace>
# Expected output: "No resources found in <namespace> namespace."

# Clean up the temporary IngressClass
kubectl delete ingressclass alb

# Expected output: ingressclass.networking.k8s.io "alb" deleted
```

**⚠️ Important**: Don't forget this cleanup step! Leaving the temporary IngressClass can cause issues if you redeploy later.

#### Step 6: Manual AWS Resource Cleanup

As a last resort, manually clean up AWS resources:
1. Go to AWS Console > EC2 > Load Balancers
2. Find and delete the ALB associated with your ingress
3. Check for and delete orphaned target groups
4. Check for and delete orphaned security groups

### Practical Example: Complete Resolution Workflow

Here's the exact sequence that successfully resolves the stuck ingress issue:

```bash
# 1. Identify the problem
kubectl get ingress -n 3-tier-app-eks
# Shows: 3-tier-app-ingress still exists despite deletion attempts

kubectl describe ingress 3-tier-app-ingress -n 3-tier-app-eks
# Shows: "failed load groupID due to invalid ingress class: IngressClass.networking.k8s.io "alb" not found"

# 2. Create temporary IngressClass
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: alb
spec:
  controller: ingress.k8s.aws/alb
EOF
# Output: ingressclass.networking.k8s.io/alb created

# 3. Delete the ingress (should work now)
kubectl delete ingress 3-tier-app-ingress -n 3-tier-app-eks
# Output: ingress.networking.k8s.io "3-tier-app-ingress" deleted
# OR: Error from server (NotFound) - means it's already gone ✅

# 4. Verify deletion
kubectl get ingress -n 3-tier-app-eks
# Output: No resources found in 3-tier-app-eks namespace.

# 5. Clean up temporary IngressClass
kubectl delete ingressclass alb
# Output: ingressclass.networking.k8s.io "alb" deleted

# 6. Final verification
kubectl get ingressclass
# Should not show 'alb' in the list
```

**Success Indicators**:
- ✅ `kubectl get ingress` returns "No resources found"
- ✅ No error messages about missing IngressClass
- ✅ Temporary IngressClass is removed
- ✅ AWS Load Balancer is deleted (check AWS Console)

### Key Learnings

1. **Delete Resources in the Correct Order**: Always delete dependent resources before their dependencies (ingress resources before IngressClass).

2. **Use Namespace Deletion with Caution**: When deleting entire namespaces, be aware that resources with finalizers may prevent namespace deletion.

3. **Implement Proper Cleanup in CI/CD**: Include proper cleanup steps in your CI/CD pipelines that handle resource dependencies correctly.

4. **Monitor Webhook Configurations**: Be aware of admission webhooks that might prevent resource modifications during cleanup.

5. **Consider Using Helm**: Using Helm for deployments can help ensure proper deletion order during uninstallation.

### Troubleshooting Decision Tree

```
Stuck Ingress Resource
├── Check Ingress Status
│   ├── Terminating → Check finalizers
│   └── Other Status → Check events
├── Check Error Messages
│   ├── Webhook Error → Disable webhook
│   ├── Finalizer Error → Remove finalizers
│   └── AWS Resource Error → Check AWS resources
├── Remove Finalizers
│   ├── Success → Resource deleted
│   └── Failure → Try force delete
├── Force Delete
│   ├── Success → Resource deleted
│   └── Failure → Try recreating IngressClass
├── Recreate IngressClass
│   ├── Success → Delete ingress → Clean up temp IngressClass
│   └── Failure → Manual AWS cleanup
├── Clean up Temporary IngressClass
│   ├── Success → Verification complete
│   └── Failure → Manual cleanup
├── Manual AWS Cleanup
│   ├── Delete ALB → Check if ingress deleted
│   ├── Delete Target Groups → Check if ingress deleted
│   └── Delete Security Groups → Check if ingress deleted
```

By following this systematic approach, you can successfully resolve stuck ingress resources and complete your EKS cluster cleanup process.
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

### Key Learnings and Best Practices

1. **Always Tag Subnets Properly**
   - Public subnets: `kubernetes.io/role/elb=1`
   - Private subnets: `kubernetes.io/role/internal-elb=1`

2. **Install AWS Load Balancer Controller Before Creating Ingress**
   - The controller must be running to process ingress resources

3. **Use Proper Annotations**
   - `alb.ingress.kubernetes.io/scheme`: "internet-facing" for external access
   - `alb.ingress.kubernetes.io/target-type`: "ip" for pods, "instance" for nodes
   - `alb.ingress.kubernetes.io/healthcheck-path`: Path for health checks

4. **Verify Backend Services**
   - Services must exist and have endpoints before creating the ingress

5. **Check IAM Permissions**
   - The controller needs permissions to create and manage AWS resources

6. **Monitor Controller Logs**
   - The controller logs provide detailed information about ALB provisioning

7. **Use IngressClass**
   - Explicitly specify the IngressClass to use the ALB controller

### Troubleshooting Decision Tree

```
Ingress Not Working
├── Check Ingress Resource
│   ├── Not Found → Create Ingress
│   └── Found but No ALB → Continue
├── Check AWS Load Balancer Controller
│   ├── Not Installed → Install Controller
│   ├── Not Running → Fix Controller
│   └── Running → Check Logs
├── Check Subnet Tags
│   ├── Missing Tags → Add Required Tags
│   └── Tags Present → Check IAM
├── Check IAM Permissions
│   ├── Missing Permissions → Fix IAM
│   └── Permissions OK → Check Services
├── Check Backend Services
│   ├── Services Don't Exist → Create Services
│   ├── No Endpoints → Fix Deployments
│   └── Services OK → Force Recreate
├── Force Recreate Ingress
│   ├── Still Not Working → Check AWS Console
│   └── Working → Done
```

By following this systematic approach, you can identify and resolve ingress deployment issues in EKS efficiently.
#### Step 3: Check Environment Variables and Secrets
```bash
# Verify the database secrets exist
kubectl get secret db-secrets -n <namespace>

# Check the content of the secrets
kubectl get secret db-secrets -n <namespace> -o yaml

# Verify ConfigMaps
kubectl get configmap app-config -n <namespace> -o yaml
```

### Solution Implementation

#### Step 1: Create a Reset Migration Job
Create a job to reset the migration state by dropping the alembic_version table:

```bash
cat > reset-migration-job.yaml << 'EOF'
apiVersion: batch/v1
kind: Job
metadata:
  name: reset-migrations
  namespace: <namespace>
spec:
  ttlSecondsAfterFinished: 100
  template:
    spec:
      containers:
      - name: reset-migrations
        image: <application-image>
        imagePullPolicy: Always
        command: ["/bin/bash", "-c"]
        args:
        - |
          export PGPASSWORD=$DB_PASSWORD
          echo "Connecting to database to reset migrations..."
          psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME -c "DROP TABLE IF EXISTS alembic_version;"
          echo "Migration metadata table dropped."
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_HOST
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_USER
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_PASSWORD
        - name: DB_NAME
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_NAME
      restartPolicy: Never
  backoffLimit: 3
EOF

kubectl apply -f reset-migration-job.yaml
```

#### Step 2: Monitor the Reset Job
```bash
kubectl get job reset-migrations -n <namespace>
kubectl logs job/reset-migrations -n <namespace> -f
```

#### Step 3: Create a Fresh Migration Job
Create a job to initialize fresh migrations:

```bash
cat > migration_job.yaml << 'EOF'
apiVersion: batch/v1
kind: Job
metadata:
  name: database-migration
  namespace: <namespace>
spec:
  ttlSecondsAfterFinished: 100
  template:
    spec:
      containers:
      - name: migration
        image: <application-image>
        imagePullPolicy: Always
        command: ["/bin/bash", "-c"]
        args:
        - |
          export FLASK_APP=run.py
          echo "Running database migrations with fresh initialization..."
          
          # Remove existing migrations directory if it exists
          rm -rf migrations
          
          # Initialize fresh migrations
          flask db init
          
          # Create and apply initial migration
          flask db migrate -m "Initial migration"
          flask db upgrade
          
          # Run seed data if needed
          echo "Checking if seed data is needed..."
          python seed_data.py
          
          echo "Database setup completed successfully!"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DATABASE_URL
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: SECRET_KEY
        - name: FLASK_APP
          value: "run.py"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_HOST
        - name: DB_PORT
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_PORT
        - name: DB_NAME
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_NAME
        - name: FLASK_DEBUG
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: FLASK_DEBUG
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_USER
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_PASSWORD
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      restartPolicy: Never
      activeDeadlineSeconds: 300
  backoffLimit: 3
EOF

kubectl apply -f migration_job.yaml
```

#### Step 4: Verify Migration Success
```bash
kubectl get jobs -n <namespace>
kubectl logs job/database-migration -n <namespace> -f
```

#### Step 5: Restart Application Deployments
```bash
kubectl rollout restart deployment/backend -n <namespace>
kubectl rollout restart deployment/frontend -n <namespace>
```

### Key Learnings and Best Practices

#### 1. Migration State Management
- **Use Idempotent Migrations**: Design migrations to be safely rerunnable
- **Version Control Migrations**: Keep migration files in version control
- **Backup Before Migrations**: Always backup the database before running migrations

#### 2. Environment Configuration
- **Complete Secret Configuration**: Ensure all required keys are present in Kubernetes Secrets
- **Consistent Environment Variables**: Maintain consistent naming between Secret/ConfigMap keys and environment variables
- **Avoid Duplicate Configuration**: Don't define the same configuration in multiple places

#### 3. Troubleshooting Methodology
- **Isolate the Issue**: Determine if it's a connectivity, configuration, or code issue
- **Test Database Connectivity**: Always test database connectivity from within the cluster
- **Check Logs Thoroughly**: Migration logs often contain specific error messages
- **Use Debug Pods**: Create temporary pods to test connectivity and queries

#### 4. Prevention Strategies
- **Migration Health Checks**: Add health checks to verify migration success
- **Staged Deployments**: Deploy migrations separately from application code
- **Automated Testing**: Test migrations in CI/CD pipeline before deployment
- **Rollback Plan**: Always have a plan to rollback migrations if they fail

### Common Migration Errors and Solutions

#### Error: "Can't locate revision"
**Cause**: Alembic can't find a revision mentioned in the database
**Solution**: Reset the alembic_version table and reinitialize migrations

#### Error: "Database connection refused"
**Cause**: Network connectivity or security group issues
**Solution**: Verify security groups, network policies, and database endpoint

#### Error: "Permission denied"
**Cause**: Incorrect database credentials or insufficient privileges
**Solution**: Verify secrets and database user permissions

#### Error: "Table already exists"
**Cause**: Conflicting schema changes
**Solution**: Drop conflicting tables or modify migration to handle existing tables

### Troubleshooting Decision Tree

```
Migration Failure
├── Check Job Status
│   ├── Failed → Check logs
│   └── Completed → Check application logs
├── Check Migration Logs
│   ├── Connection Error → Check connectivity
│   ├── Alembic Error → Check migration state
│   └── Permission Error → Check credentials
├── Check Database Connectivity
│   ├── Can't Connect → Check network/security
│   └── Can Connect → Check schema/tables
├── Check Environment Variables
│   ├── Missing Variables → Fix configuration
│   └── Variables Present → Check values
├── Reset and Retry
│   ├── Drop alembic_version → Reinitialize
│   └── Fresh Migration → Apply and verify
```

By following this systematic approach, you can effectively troubleshoot and resolve database migration issues in Kubernetes environments, ensuring your applications have the correct database schema and can operate properly.
  DATABASE_URL: cG9zdGdyZXNxbDovL3Bvc3RncmVzOmRKUVpacnlMTGlAYm9vdGNhbXAtZGV2LWRiLmM2dDRxMGc2aTRuNS51cy1lYXN0LTEucmRzLmFtYXpvbmF3cy5jb206NTQzMi9wb3N0Z3Jlcw==
  SECRET_KEY: c29tZS1yYW5kb20tc2VjcmV0LWtleQ==
EOF

# Apply the updated Secret
kubectl apply -f updated-secrets.yaml
```

The updated Secret includes:
- `DB_PASSWORD`: Base64-encoded database password
- `DATABASE_URL`: Base64-encoded full database connection string
- `SECRET_KEY`: Base64-encoded secret key for the Flask application

#### Step 2: Update the Migration Job Configuration

```bash
# Create a temporary file with the updated Job definition
cat <<EOF > updated-migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: database-migration
  namespace: 3-tier-app-eks
spec:
  ttlSecondsAfterFinished: 100
  template:
    spec:
      containers:
      - name: migration
        image: livingdevopswithakhilesh/devopsdozo:backend-latest
        imagePullPolicy: Always
        command: ["/bin/bash", "-c", "./migrate.sh"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DATABASE_URL
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: SECRET_KEY
        - name: FLASK_APP
          value: "run.py"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_HOST
        - name: DB_PORT
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_PORT
        - name: DB_NAME
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_NAME
        - name: FLASK_DEBUG
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: FLASK_DEBUG
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_USER
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: DB_PASSWORD
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      restartPolicy: Never
      activeDeadlineSeconds: 300
  backoffLimit: 3
EOF
```

Key changes in the Job configuration:
- Fixed the reference to `DB_USER` instead of `DB_USERNAME`
- Ensured all environment variables reference the correct keys in the Secret and ConfigMap

#### Step 3: Delete the Failed Job and Apply the Updated Configuration

```bash
# Delete the failed job
kubectl delete job database-migration -n 3-tier-app-eks

# Apply the updated job
kubectl apply -f updated-migration-job.yaml

# Monitor the job status
kubectl get jobs -n 3-tier-app-eks -w

# Check the job logs
kubectl logs job/database-migration -n 3-tier-app-eks -f
```

#### Step 4: Verify Database Connectivity

After the migration job completes successfully, verify database connectivity:

```bash
# Run a test pod to verify database connectivity
kubectl run db-test --rm -it --image=postgres:13 -n 3-tier-app-eks -- bash

# Inside the pod, connect to the database
PGPASSWORD=dJQZZryLLi psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U postgres -d postgres

# Run a test query
SELECT COUNT(*) FROM topics;

# Exit the database and pod
\q
exit
```

### RDS Connectivity Key Learnings

1. **Complete Secret Configuration**: Ensure all required keys are present in Kubernetes Secrets before deploying applications that depend on them.

2. **Consistent Environment Variable Naming**: Maintain consistent naming conventions between Secret/ConfigMap keys and the environment variables that reference them.

3. **Avoid Duplicate Configuration**: Don't define the same configuration in multiple places (e.g., both ConfigMap and Secret) to prevent conflicts.

4. **Systematic Troubleshooting Approach**:
   - Check pod status and error messages
   - Examine ConfigMaps and Secrets
   - Verify environment variable references
   - Fix configuration issues systematically

5. **Testing Database Connectivity**: Always test database connectivity from within the cluster before deploying applications that depend on the database.

6. **Prefer Connection Strings**: When possible, use a complete connection string (DATABASE_URL) rather than individual connection parameters to simplify configuration and reduce the chance of errors.

7. **Secret Management Best Practices**:
   - Use base64 encoding for Secret values
   - Include all required keys in a single Secret
   - Validate Secret contents after creation

By following these learnings and the systematic troubleshooting approach outlined above, you can quickly identify and resolve RDS connectivity issues in EKS deployments.

## Database Credential Synchronization Issues in EKS

### Issue Summary
**Problem**: Database connectivity tests fail with authentication errors despite having correct database credentials in AWS Secrets Manager.

**Symptoms**:
- `FATAL: password authentication failed for user` errors
- Database connection timeouts or authentication failures
- Kubernetes secrets contain outdated or incorrect database passwords
- AWS Secrets Manager shows different credentials than Kubernetes secrets

**Impact**: Applications cannot connect to the database, causing deployment failures and service disruptions.

### Root Cause Analysis

#### Primary Issue
**Credential Mismatch**: Kubernetes secrets contain outdated database credentials that don't match the current credentials stored in AWS Secrets Manager.

#### Why This Happens
1. **Infrastructure Recreation**: When Terraform destroys and recreates RDS instances, new passwords are generated
2. **Manual Password Changes**: Database passwords changed in AWS but not updated in Kubernetes
3. **Deployment Timing**: Kubernetes secrets created before database credentials are finalized
4. **Static Configuration**: Hardcoded passwords in Kubernetes manifests become stale over time

#### Technical Details
- **AWS RDS**: Stores current, active database credentials
- **AWS Secrets Manager**: Contains the authoritative database connection information
- **Kubernetes Secrets**: May contain base64-encoded outdated credentials
- **Application Pods**: Use Kubernetes secrets, not AWS Secrets Manager directly

### Diagnostic Steps to Identify the Issue

#### Step 1: Check Database Connectivity Error
```bash
# Attempt database connection and observe the error
kubectl run debug-pod --rm -it --image=postgres:13 -n 3-tier-app-eks -- bash
# Inside pod: PGPASSWORD=<password> psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U postgres -d postgres
# Expected error: FATAL: password authentication failed for user "postgres"
```

#### Step 2: Retrieve Current Credentials from AWS Secrets Manager
```bash
# Get the authoritative database credentials
aws secretsmanager get-secret-value \
    --secret-id db/bootcamp-dev-db \
    --region us-east-1 \
    --query SecretString \
    --output text

# Example output: postgresql://postgres:cvf4BntZBh@bootcamp-dev-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com:5432/postgres
```

#### Step 3: Check Kubernetes Secret Contents
```bash
# View the current Kubernetes secret
kubectl get secret db-secrets -n 3-tier-app-eks -o yaml

# Decode the password from Kubernetes secret
kubectl get secret db-secrets -n 3-tier-app-eks -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
echo  # Add newline for readability

# Decode other credentials for comparison
kubectl get secret db-secrets -n 3-tier-app-eks -o jsonpath='{.data.DB_USER}' | base64 -d
echo
kubectl get secret db-secrets -n 3-tier-app-eks -o jsonpath='{.data.DB_HOST}' | base64 -d
echo
```

#### Step 4: Compare Credentials
```bash
# Extract password from AWS Secrets Manager connection string
# From: postgresql://postgres:cvf4BntZBh@host:port/db
# Password is: cvf4BntZBh

# Compare with Kubernetes secret password
# If they don't match, you've found the root cause!
```

### Solution Implementation

#### Automated Solution (Recommended)

**Script Created**: `update-db-secrets.sh`
**Location**: `/DevOps-Project-36/3-tier-app-eks/k8s/update-db-secrets.sh`

This script automatically:
1. Retrieves current credentials from AWS Secrets Manager
2. Updates Kubernetes secrets with correct credentials
3. Tests database connectivity to verify the fix

```bash
# Make the script executable
chmod +x 3-tier-app-eks/k8s/update-db-secrets.sh

# Run the automated fix
./3-tier-app-eks/k8s/update-db-secrets.sh
```

**Script Features**:
- ✅ Automatically parses PostgreSQL connection strings
- ✅ Base64 encodes credentials for Kubernetes
- ✅ Updates secrets using `kubectl patch`
- ✅ Performs connectivity test to verify fix
- ✅ Provides detailed logging of each step

#### Manual Solution Steps

**Step 1: Extract Credentials from AWS Secrets Manager**
```bash
# Get the secret value
SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id db/bootcamp-dev-db \
    --region us-east-1 \
    --query SecretString \
    --output text)

echo "Connection string: $SECRET_VALUE"

# Parse the PostgreSQL connection string manually
# Format: postgresql://username:password@host:port/database
# Example: postgresql://postgres:cvf4BntZBh@bootcamp-dev-db.c6t4q0g6i4n5.us-east-1.rds.amazonaws.com:5432/postgres
```

**Step 2: Extract Individual Components**
```bash
# Extract components using sed
DB_USER=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$SECRET_VALUE" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_NAME=$(echo "$SECRET_VALUE" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "DB_USER: $DB_USER"
echo "DB_PASSWORD: $DB_PASSWORD"
echo "DB_HOST: $DB_HOST"
echo "DB_NAME: $DB_NAME"
```

**Step 3: Base64 Encode the Values**
```bash
# Encode values for Kubernetes secrets
DB_HOST_B64=$(echo -n "$DB_HOST" | base64 -w 0)
DB_USER_B64=$(echo -n "$DB_USER" | base64 -w 0)
DB_PASSWORD_B64=$(echo -n "$DB_PASSWORD" | base64 -w 0)
DB_NAME_B64=$(echo -n "$DB_NAME" | base64 -w 0)
DATABASE_URL_B64=$(echo -n "$SECRET_VALUE" | base64 -w 0)

echo "Encoded values ready for Kubernetes"
```

**Step 4: Update Kubernetes Secret**
```bash
# Update the secret using kubectl patch
kubectl patch secret db-secrets -n 3-tier-app-eks --type='merge' -p="{
  \"data\": {
    \"DB_HOST\": \"$DB_HOST_B64\",
    \"DB_USER\": \"$DB_USER_B64\",
    \"DB_PASSWORD\": \"$DB_PASSWORD_B64\",
    \"DB_NAME\": \"$DB_NAME_B64\",
    \"DATABASE_URL\": \"$DATABASE_URL_B64\"
  }
}"

echo "Kubernetes secret updated successfully!"
```

### Verification Steps

#### Step 1: Verify Secret Update
```bash
# Check that the secret was updated
kubectl get secret db-secrets -n 3-tier-app-eks -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
echo

# Should now match the password from AWS Secrets Manager
```

#### Step 2: Test Database Connectivity
```bash
# Quick connectivity test
kubectl run db-connectivity-test --rm -it --image=postgres:13 -n 3-tier-app-eks --restart=Never -- bash -c "
PGPASSWORD='$DB_PASSWORD' psql -h postgres-db.3-tier-app-eks.svc.cluster.local -U '$DB_USER' -d '$DB_NAME' -c 'SELECT version();'
"

# Expected output: PostgreSQL version information
```

#### Step 3: Test Application Connectivity
```bash
# Check if backend pods can now connect to database
kubectl logs -n 3-tier-app-eks -l app=backend --tail=20

# Look for successful database connection logs
```

### Script Details

#### Script Name and Location
- **File**: `update-db-secrets.sh`
- **Full Path**: `/DevOps-Project-36/3-tier-app-eks/k8s/update-db-secrets.sh`
- **Purpose**: Automated database credential synchronization and connectivity testing

#### Script Functionality
```bash
#!/bin/bash
# The script performs the following operations:

1. Retrieves credentials from AWS Secrets Manager
2. Parses PostgreSQL connection string components
3. Base64 encodes values for Kubernetes
4. Updates Kubernetes secret using kubectl patch
5. Tests database connectivity automatically
6. Provides detailed logging and error handling
```

#### Key Script Features
- **Error Handling**: Uses `set -e` to exit on any error
- **Logging**: Provides step-by-step progress indicators
- **Security**: Hides password in output logs
- **Validation**: Tests connectivity after updating credentials
- **Automation**: No manual intervention required

### Key Learnings

#### Database Credential Management Best Practices

1. **Single Source of Truth**: Always use AWS Secrets Manager as the authoritative source for database credentials

2. **Automated Synchronization**: Create scripts to automatically sync credentials between AWS and Kubernetes

3. **Regular Validation**: Test database connectivity after any infrastructure changes

4. **Avoid Hardcoding**: Never hardcode database passwords in Kubernetes manifests

5. **Version Control**: Keep credential sync scripts in version control for team access

#### Prevention Strategies

1. **Infrastructure as Code**: Use Terraform to manage both RDS and Kubernetes secrets consistently

2. **CI/CD Integration**: Include credential sync in deployment pipelines

3. **Monitoring**: Set up alerts for database connectivity failures

4. **Documentation**: Maintain clear troubleshooting guides for common issues

5. **Testing**: Always test database connectivity as part of deployment validation

### Common Commands Reference

#### Quick Diagnostic Commands
```bash
# Check current Kubernetes secret password
kubectl get secret db-secrets -n 3-tier-app-eks -o jsonpath='{.data.DB_PASSWORD}' | base64 -d

# Get AWS Secrets Manager password
aws secretsmanager get-secret-value --secret-id db/bootcamp-dev-db --region us-east-1 --query SecretString --output text

# Test database connectivity
kubectl run db-test --rm -it --image=postgres:13 -n 3-tier-app-eks -- bash

# Run automated fix
./3-tier-app-eks/k8s/update-db-secrets.sh
```

This comprehensive approach ensures that database credential issues are quickly identified, resolved, and prevented in future deployments.
