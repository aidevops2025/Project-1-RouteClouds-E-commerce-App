# New 3-Tier Project Deletion Process

This document provides a comprehensive guide for safely and completely deleting all resources created during the 3-tier application deployment on AWS EKS. It consolidates best practices, troubleshooting solutions, and systematic cleanup procedures to ensure no orphaned resources remain.

## Table of Contents
1. [Overview and Prerequisites](#overview-and-prerequisites)
2. [Pre-Deletion Planning](#pre-deletion-planning)
3. [Phase 1: Application Layer Cleanup](#phase-1-application-layer-cleanup)
4. [Phase 2: Kubernetes Infrastructure Cleanup](#phase-2-kubernetes-infrastructure-cleanup)
5. [Phase 3: AWS Load Balancer and Networking Cleanup](#phase-3-aws-load-balancer-and-networking-cleanup)
6. [Phase 4: EKS Add-ons and IAM Cleanup](#phase-4-eks-add-ons-and-iam-cleanup)
7. [Phase 5: Terraform Infrastructure Destruction](#phase-5-terraform-infrastructure-destruction)
8. [Phase 6: Manual Resource Verification and Cleanup](#phase-6-manual-resource-verification-and-cleanup)
9. [Troubleshooting Common Deletion Issues](#troubleshooting-common-deletion-issues)
10. [Regional Considerations](#regional-considerations)
11. [Final Verification and Cost Optimization](#final-verification-and-cost-optimization)

## Overview and Prerequisites

### Project Context
This deletion process is designed for the 3-tier application deployment that includes:
- **Frontend**: React application deployed on EKS
- **Backend**: Flask API deployed on EKS  
- **Database**: PostgreSQL RDS instance
- **Infrastructure**: EKS cluster, VPC, security groups, load balancers
- **Monitoring**: Optional Prometheus and Grafana setup
- **CI/CD**: GitHub Actions integration with ECR

### Prerequisites Checklist

Before starting the deletion process, ensure you have:

- [ ] **AWS CLI** configured with appropriate permissions
- [ ] **kubectl** configured to access your EKS cluster
- [ ] **Terraform** installed (same version used for deployment)
- [ ] **eksctl** installed for EKS-specific operations
- [ ] **Helm** installed for managing Kubernetes packages
- [ ] All deployment files and directories available
- [ ] **Data Backup** completed for any important application or database data
- [ ] **Cost Analysis** reviewed to understand current resource costs
- [ ] **Team Notification** sent about planned infrastructure deletion

### Required Permissions

Ensure your AWS credentials have the following permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "eks:*",
        "ec2:*",
        "rds:*",
        "iam:*",
        "elasticloadbalancing:*",
        "route53:*",
        "acm:*",
        "kms:*",
        "secretsmanager:*",
        "resourcegroupstaggingapi:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Pre-Deletion Planning

### Step 1: Document Current Infrastructure

Create a comprehensive inventory of all resources before deletion:

```bash
# Create documentation directory
mkdir -p deletion-logs/$(date +%Y%m%d-%H%M%S)
cd deletion-logs/$(date +%Y%m%d-%H%M%S)

# Document EKS resources
echo "=== EKS Cluster Information ===" > infrastructure-inventory.txt
aws eks list-clusters --region us-east-1 >> infrastructure-inventory.txt
aws eks describe-cluster --name routeclouds-prod-cluster --region us-east-1 >> infrastructure-inventory.txt

# Document node groups
echo "=== EKS Node Groups ===" >> infrastructure-inventory.txt
aws eks list-nodegroups --cluster-name routeclouds-prod-cluster --region us-east-1 >> infrastructure-inventory.txt

# Document RDS instances
echo "=== RDS Instances ===" >> infrastructure-inventory.txt
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier,`routeclouds-prod-db`)]' >> infrastructure-inventory.txt

# Document VPC and networking
echo "=== VPC Information ===" >> infrastructure-inventory.txt
VPC_ID=$(aws eks describe-cluster --name routeclouds-prod-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)
aws ec2 describe-vpcs --vpc-ids $VPC_ID >> infrastructure-inventory.txt
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" >> infrastructure-inventory.txt

# Document load balancers
echo "=== Load Balancers ===" >> infrastructure-inventory.txt
aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[?contains(LoadBalancerName,`k8s-3tierapp`)]' >> infrastructure-inventory.txt

# Document security groups
echo "=== Security Groups ===" >> infrastructure-inventory.txt
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[?GroupName!='default']" >> infrastructure-inventory.txt
```

### Step 2: Backup Critical Data

```bash
# Backup RDS database (if needed)
aws rds create-db-snapshot \
  --db-instance-identifier routeclouds-prod-db \
  --db-snapshot-identifier routeclouds-prod-db-final-backup-$(date +%Y%m%d) \
  --region us-east-1

# Export Kubernetes configurations
kubectl get all -n routeclouds-ns -o yaml > k8s-resources-backup.yaml
kubectl get configmaps,secrets -n routeclouds-ns -o yaml > k8s-configs-backup.yaml

# Backup Terraform state
cp ../infra/terraform.tfstate terraform-state-backup.json
```

### Step 3: Verify Cluster Connectivity

```bash
# Test cluster connectivity
kubectl cluster-info
kubectl get nodes
kubectl get namespaces

# Verify current context
kubectl config current-context
kubectl config get-contexts
```

## Phase 1: Application Layer Cleanup

### Step 1.1: Stop Application Traffic

**⚠️ Important**: Gracefully stop application traffic before resource deletion.

```bash
# Navigate to Kubernetes manifests directory
cd routeclouds-ns/k8s/

# Scale down deployments to zero replicas
echo "=== Scaling Down Application Deployments ==="
kubectl scale deployment frontend --replicas=0 -n routeclouds-ns
kubectl scale deployment backend --replicas=0 -n routeclouds-ns

# Wait for pods to terminate gracefully
echo "Waiting for pods to terminate..."
kubectl wait --for=delete pod -l app=frontend -n routeclouds-ns --timeout=300s
kubectl wait --for=delete pod -l app=backend -n routeclouds-ns --timeout=300s

# Verify no application pods are running
kubectl get pods -n routeclouds-ns
```

### Step 1.2: Delete Ingress Resources (Critical First Step)

**⚠️ Critical**: Delete ingress first to trigger ALB cleanup.

```bash
echo "=== Deleting Ingress Resources ==="

# Check current ingress status
kubectl get ingress -n routeclouds-ns
kubectl describe ingress routeclouds-ingress -n routeclouds-ns

# Delete ingress resource
kubectl delete -f ingress.yaml

# Monitor ALB deletion progress
echo "Monitoring ALB deletion progress..."
while true; do
  ALB_COUNT=$(aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[?contains(LoadBalancerName,`k8s-3tierapp`)]' --output text | wc -l)
  if [ "$ALB_COUNT" -eq 0 ]; then
    echo "✅ ALB successfully deleted"
    break
  else
    echo "⏳ ALB still exists, waiting 30 seconds..."
    sleep 30
  fi
done
```

### Step 1.3: Handle Stuck Ingress Resources

If ingress gets stuck in "Terminating" state:

```bash
# Check for stuck ingress
INGRESS_STATUS=$(kubectl get ingress routeclouds-ingress -n routeclouds-ns -o jsonpath='{.metadata.deletionTimestamp}' 2>/dev/null)

if [ ! -z "$INGRESS_STATUS" ]; then
  echo "⚠️ Ingress stuck in terminating state, applying fix..."
  
  # Create temporary IngressClass if missing
  cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: alb
spec:
  controller: ingress.k8s.aws/alb
EOF

  # Remove finalizers to force deletion
  kubectl patch ingress routeclouds-ingress -n routeclouds-ns -p '{"metadata":{"finalizers":[]}}' --type=merge
  
  # Force delete if still stuck
  kubectl delete ingress routeclouds-ingress -n routeclouds-ns --grace-period=0 --force
  
  # Clean up temporary IngressClass
  kubectl delete ingressclass alb
fi

# Verify ingress deletion
kubectl get ingress -n routeclouds-ns
```

### Step 1.4: Delete Application Deployments and Services

```bash
echo "=== Deleting Application Deployments and Services ==="

# Delete frontend resources
kubectl delete -f frontend.yaml
echo "✅ Frontend resources deleted"

# Delete backend resources  
kubectl delete -f backend.yaml
echo "✅ Backend resources deleted"

# Verify deployments and services are deleted
kubectl get deployments,svc -n routeclouds-ns
```

### Step 1.5: Delete Database and Supporting Resources

```bash
echo "=== Deleting Database and Supporting Resources ==="

# Delete database migration job
kubectl delete -f migration_job.yaml

# Delete database service
kubectl delete -f database-service.yaml

# Delete horizontal pod autoscaler
kubectl delete -f hpa.yaml

# Verify database resources are deleted
kubectl get jobs,svc,hpa -n routeclouds-ns
```

### Step 1.6: Delete Configuration Resources

```bash
echo "=== Deleting Configuration Resources ==="

# Delete configmaps
kubectl delete -f configmap.yaml

# Delete secrets
kubectl delete -f secrets.yaml

# Verify configmaps and secrets are deleted
kubectl get configmaps,secrets -n routeclouds-ns
```

### Step 1.7: Delete Namespace

```bash
echo "=== Deleting Application Namespace ==="

# Delete namespace (this will delete any remaining resources in the namespace)
kubectl delete -f namespace.yaml

# Monitor namespace deletion
echo "Monitoring namespace deletion..."
while kubectl get namespace routeclouds-ns >/dev/null 2>&1; do
  echo "⏳ Namespace still exists, waiting 15 seconds..."
  sleep 15
done

echo "✅ Namespace successfully deleted"
```

### Step 1.8: Handle Stuck Namespace

If namespace gets stuck in "Terminating" state:

```bash
# Check if namespace is stuck
NS_STATUS=$(kubectl get namespace routeclouds-ns -o jsonpath='{.status.phase}' 2>/dev/null)

if [ "$NS_STATUS" = "Terminating" ]; then
  echo "⚠️ Namespace stuck in terminating state, applying fix..."
  
  # Remove finalizers to force deletion
  kubectl get namespace routeclouds-ns -o json | \
    jq '.spec.finalizers = []' | \
    kubectl replace --raw "/api/v1/namespaces/routeclouds-ns/finalize" -f -
  
  echo "✅ Namespace finalizers removed"
fi

# Final verification
kubectl get namespace routeclouds-ns
```

## Phase 2: Kubernetes Infrastructure Cleanup

### Step 2.1: Uninstall Monitoring Stack (if deployed)

```bash
echo "=== Cleaning Up Monitoring Stack ==="

# Uninstall Prometheus and Grafana if deployed
if helm list -n monitoring | grep -q prometheus; then
  echo "Uninstalling Prometheus..."
  helm uninstall prometheus -n monitoring
fi

if helm list -n monitoring | grep -q grafana; then
  echo "Uninstalling Grafana..."
  helm uninstall grafana -n monitoring
fi

# Delete monitoring namespace
kubectl delete namespace monitoring --ignore-not-found=true

echo "✅ Monitoring stack cleanup completed"
```

### Step 2.2: Uninstall AWS Load Balancer Controller

```bash
echo "=== Uninstalling AWS Load Balancer Controller ==="

# Check if ALB controller is installed
if helm list -n kube-system | grep -q aws-load-balancer-controller; then
  # Uninstall ALB controller using Helm
  helm uninstall aws-load-balancer-controller -n kube-system
  echo "✅ ALB controller uninstalled via Helm"
else
  echo "ℹ️ ALB controller not found via Helm, checking for manual installation..."

  # Check for manual installation
  if kubectl get deployment aws-load-balancer-controller -n kube-system >/dev/null 2>&1; then
    kubectl delete deployment aws-load-balancer-controller -n kube-system
    echo "✅ ALB controller deployment deleted"
  fi
fi

# Delete the ALB controller service account
kubectl delete serviceaccount aws-load-balancer-controller -n kube-system --ignore-not-found=true

# Verify ALB controller is completely removed
kubectl get deployment -n kube-system aws-load-balancer-controller
```

### Step 2.3: Delete IAM Service Account for ALB Controller

```bash
echo "=== Deleting IAM Service Account ==="

# Delete the IAM service account
eksctl delete iamserviceaccount \
  --cluster=routeclouds-prod-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --region=us-east-1

# Verify service account deletion
eksctl get iamserviceaccount --cluster routeclouds-prod-cluster --region us-east-1
```

### Step 2.4: Delete IAM Policy for ALB Controller

```bash
echo "=== Deleting IAM Policy for ALB Controller ==="

# Get the policy ARN
POLICY_ARN=$(aws iam list-policies --query 'Policies[?PolicyName==`AWSLoadBalancerControllerIAMPolicy`].Arn' --output text)

if [ ! -z "$POLICY_ARN" ] && [ "$POLICY_ARN" != "None" ]; then
  # Delete the policy
  aws iam delete-policy --policy-arn $POLICY_ARN
  echo "✅ ALB Controller IAM policy deleted: $POLICY_ARN"
else
  echo "ℹ️ ALB Controller IAM policy not found or already deleted"
fi

# Verify policy deletion
aws iam list-policies --query 'Policies[?PolicyName==`AWSLoadBalancerControllerIAMPolicy`].Arn' --output text
```

## Phase 3: AWS Load Balancer and Networking Cleanup

### Step 3.1: Force Delete Orphaned Load Balancers

```bash
echo "=== Checking for Orphaned Load Balancers ==="

# List load balancers related to the project
ALB_ARNS=$(aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[?contains(LoadBalancerName,`k8s-3tierapp`)].LoadBalancerArn' --output text)

if [ ! -z "$ALB_ARNS" ]; then
  echo "⚠️ Found orphaned load balancers, deleting..."

  for ALB_ARN in $ALB_ARNS; do
    echo "Deleting load balancer: $ALB_ARN"

    # Get and delete target groups first
    TARGET_GROUPS=$(aws elbv2 describe-target-groups --load-balancer-arn $ALB_ARN --query 'TargetGroups[].TargetGroupArn' --output text 2>/dev/null)

    for TG_ARN in $TARGET_GROUPS; do
      echo "Deleting target group: $TG_ARN"
      aws elbv2 delete-target-group --target-group-arn $TG_ARN
    done

    # Delete the load balancer
    aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN
    echo "✅ Load balancer deleted: $ALB_ARN"
  done
else
  echo "✅ No orphaned load balancers found"
fi
```

### Step 3.2: Clean Up Route53 Records (if created)

```bash
echo "=== Cleaning Up Route53 Records ==="

# Note: Replace 'yourdomain.com' with your actual domain
DOMAIN_NAME="yourdomain.com"
RECORD_NAME="app.${DOMAIN_NAME}"

# Get the hosted zone ID (if exists)
ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${DOMAIN_NAME}.'].Id" --output text 2>/dev/null | sed 's/\/hostedzone\///')

if [ ! -z "$ZONE_ID" ] && [ "$ZONE_ID" != "None" ]; then
  echo "Found hosted zone: $ZONE_ID"

  # Check if record exists
  RECORD_EXISTS=$(aws route53 list-resource-record-sets --hosted-zone-id $ZONE_ID --query "ResourceRecordSets[?Name=='${RECORD_NAME}.']" --output text)

  if [ ! -z "$RECORD_EXISTS" ]; then
    echo "⚠️ Manual Route53 record cleanup required for: $RECORD_NAME"
    echo "Please delete the record manually in the AWS Console or update this script with the correct ALB DNS name"
  else
    echo "✅ No Route53 records found for cleanup"
  fi
else
  echo "ℹ️ No hosted zone found for domain: $DOMAIN_NAME"
fi
```

### Step 3.3: Delete ACM Certificates (if created)

```bash
echo "=== Cleaning Up ACM Certificates ==="

# List certificates that might be related to the project
CERT_ARNS=$(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?contains(DomainName, 'app.') || contains(DomainName, '3tier')].CertificateArn" --output text)

if [ ! -z "$CERT_ARNS" ]; then
  echo "⚠️ Found certificates that may need manual review:"
  for CERT_ARN in $CERT_ARNS; do
    CERT_DOMAIN=$(aws acm describe-certificate --certificate-arn $CERT_ARN --region us-east-1 --query "Certificate.DomainName" --output text)
    echo "Certificate: $CERT_DOMAIN ($CERT_ARN)"
    echo "⚠️ Please review and delete manually if related to this project"
  done
else
  echo "✅ No ACM certificates found for cleanup"
fi
```

## Phase 4: EKS Add-ons and IAM Cleanup

### Step 4.1: Delete GitHub Actions OIDC Resources (if created)

```bash
echo "=== Cleaning Up GitHub Actions OIDC Resources ==="

# Delete GitHub Actions IAM role (if exists)
GITHUB_ROLE_NAME="GitHubActionsEKSDeployRole"
if aws iam get-role --role-name $GITHUB_ROLE_NAME >/dev/null 2>&1; then
  echo "Found GitHub Actions role, cleaning up..."

  # List and detach attached policies
  POLICIES=$(aws iam list-attached-role-policies --role-name $GITHUB_ROLE_NAME --query "AttachedPolicies[*].PolicyArn" --output text)

  for policy in $POLICIES; do
    echo "Detaching policy: $policy"
    aws iam detach-role-policy --role-name $GITHUB_ROLE_NAME --policy-arn $policy
  done

  # Delete the role
  aws iam delete-role --role-name $GITHUB_ROLE_NAME
  echo "✅ GitHub Actions IAM role deleted"
else
  echo "ℹ️ GitHub Actions IAM role not found"
fi

# Delete OIDC provider (if exists and not used by other clusters)
OIDC_ARN=$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'oidc.eks.us-east-1.amazonaws.com')].Arn" --output text)

if [ ! -z "$OIDC_ARN" ] && [ "$OIDC_ARN" != "None" ]; then
  echo "⚠️ Found OIDC provider: $OIDC_ARN"
  echo "⚠️ Please verify this is not used by other EKS clusters before deleting"
  echo "To delete: aws iam delete-open-id-connect-provider --open-id-connect-provider-arn $OIDC_ARN"
else
  echo "ℹ️ No OIDC provider found for cleanup"
fi
```

### Step 4.2: Check for Orphaned Security Groups

```bash
echo "=== Checking for Orphaned Security Groups ==="

# Get VPC ID from the cluster (if still exists)
VPC_ID=$(aws eks describe-cluster --name routeclouds-prod-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text 2>/dev/null)

if [ ! -z "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  echo "Checking security groups in VPC: $VPC_ID"

  # List security groups in the VPC (excluding default)
  SECURITY_GROUPS=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[?GroupName!='default'].{ID:GroupId,Name:GroupName}" --output text)

  if [ ! -z "$SECURITY_GROUPS" ]; then
    echo "⚠️ Found security groups that may need cleanup:"
    echo "$SECURITY_GROUPS"
    echo "⚠️ These will be cleaned up during Terraform destroy"
  else
    echo "✅ No additional security groups found"
  fi
else
  echo "ℹ️ Cannot determine VPC ID (cluster may already be deleted)"
fi
```

## Phase 5: Terraform Infrastructure Destruction

### Step 5.1: Prepare for Terraform Destroy

```bash
echo "=== Preparing for Terraform Infrastructure Destruction ==="

# Navigate to infrastructure directory
cd ../infra/

# Verify Terraform configuration
if [ ! -f "main.tf" ]; then
  echo "❌ Error: Not in correct Terraform directory"
  exit 1
fi

# Initialize Terraform (ensure latest providers)
terraform init -upgrade

# Refresh Terraform state to match reality
terraform refresh

# Review what will be destroyed
echo "=== Reviewing Resources to be Destroyed ==="
terraform plan -destroy
```

### Step 5.2: Systematic Infrastructure Destruction

**⚠️ Important**: Destroy resources in the correct order to avoid dependency issues.

```bash
echo "=== Starting Systematic Infrastructure Destruction ==="

# Step 1: Destroy EKS node groups first (if they exist and are causing issues)
echo "Phase 5.2.1: Destroying EKS Node Groups..."
if terraform state list | grep -q "module.eks.module.eks_managed_node_group"; then
  terraform destroy -target=module.eks.module.eks_managed_node_group -auto-approve
  echo "✅ EKS node groups destroyed"
else
  echo "ℹ️ No EKS node groups found in state"
fi

# Step 2: Destroy EKS cluster
echo "Phase 5.2.2: Destroying EKS Cluster..."
if terraform state list | grep -q "module.eks"; then
  terraform destroy -target=module.eks -auto-approve
  echo "✅ EKS cluster destroyed"
else
  echo "ℹ️ No EKS cluster found in state"
fi

# Step 3: Destroy RDS instance
echo "Phase 5.2.3: Destroying RDS Instance..."
if terraform state list | grep -q "module.rds"; then
  terraform destroy -target=module.rds -auto-approve
  echo "✅ RDS instance destroyed"
else
  echo "ℹ️ No RDS instance found in state"
fi

# Step 4: Destroy remaining infrastructure
echo "Phase 5.2.4: Destroying Remaining Infrastructure..."
terraform destroy -auto-approve

echo "✅ Terraform infrastructure destruction completed"
```

### Step 5.3: Handle Terraform Destroy Issues

```bash
echo "=== Handling Potential Terraform Issues ==="

# Check if any resources remain in Terraform state
REMAINING_RESOURCES=$(terraform state list)

if [ ! -z "$REMAINING_RESOURCES" ]; then
  echo "⚠️ Some resources remain in Terraform state:"
  echo "$REMAINING_RESOURCES"

  # Try targeted destroy for remaining resources
  echo "Attempting targeted cleanup..."
  for resource in $REMAINING_RESOURCES; do
    echo "Attempting to destroy: $resource"
    terraform destroy -target="$resource" -auto-approve || echo "Failed to destroy $resource"
  done

  # Final attempt at full destroy
  echo "Final destroy attempt..."
  terraform destroy -auto-approve
else
  echo "✅ No resources remain in Terraform state"
fi
```

### Step 5.4: Terraform State Cleanup

```bash
echo "=== Terraform State Cleanup ==="

# Check final state
FINAL_STATE=$(terraform state list)

if [ -z "$FINAL_STATE" ]; then
  echo "✅ Terraform state is clean"
else
  echo "⚠️ Resources still in state, manual cleanup may be required:"
  echo "$FINAL_STATE"

  # Option to force remove from state (use with caution)
  echo "To force remove resources from state (if they're already deleted in AWS):"
  for resource in $FINAL_STATE; do
    echo "terraform state rm '$resource'"
  done
fi
```

## Phase 6: Manual Resource Verification and Cleanup

### Step 6.1: Verify EKS Cluster Deletion

```bash
echo "=== Verifying EKS Cluster Deletion ==="

# Check if EKS cluster still exists
EXISTING_CLUSTERS=$(aws eks list-clusters --region us-east-1 --query 'clusters[?contains(@, `routeclouds-prod-cluster`)]' --output text)

if [ ! -z "$EXISTING_CLUSTERS" ]; then
  echo "⚠️ EKS cluster still exists, attempting manual deletion..."

  # Delete node groups first
  NODE_GROUPS=$(aws eks list-nodegroups --cluster-name routeclouds-prod-cluster --region us-east-1 --query 'nodegroups' --output text)
  for ng in $NODE_GROUPS; do
    echo "Deleting node group: $ng"
    aws eks delete-nodegroup --cluster-name routeclouds-prod-cluster --nodegroup-name $ng --region us-east-1
  done

  # Wait for node groups to be deleted
  echo "Waiting for node groups to be deleted..."
  while [ ! -z "$(aws eks list-nodegroups --cluster-name routeclouds-prod-cluster --region us-east-1 --query 'nodegroups' --output text)" ]; do
    echo "⏳ Node groups still exist, waiting 30 seconds..."
    sleep 30
  done

  # Delete the cluster
  aws eks delete-cluster --name routeclouds-prod-cluster --region us-east-1
  echo "✅ EKS cluster deletion initiated"
else
  echo "✅ EKS cluster successfully deleted"
fi
```

### Step 6.2: Verify RDS Instance Deletion

```bash
echo "=== Verifying RDS Instance Deletion ==="

# Check if RDS instance still exists
EXISTING_RDS=$(aws rds describe-db-instances --region us-east-1 --query "DBInstances[?contains(DBInstanceIdentifier, 'routeclouds-prod-db')].DBInstanceIdentifier" --output text)

if [ ! -z "$EXISTING_RDS" ]; then
  echo "⚠️ RDS instance still exists: $EXISTING_RDS"
  echo "⚠️ Manual deletion required (WARNING: This will delete all data!)"
  echo "To delete: aws rds delete-db-instance --db-instance-identifier $EXISTING_RDS --skip-final-snapshot --delete-automated-backups --region us-east-1"
else
  echo "✅ RDS instance successfully deleted"
fi
```

### Step 6.3: Check for Orphaned Network Interfaces

```bash
echo "=== Checking for Orphaned Network Interfaces ==="

# List network interfaces that might be related to the cluster
ORPHANED_ENIS=$(aws ec2 describe-network-interfaces --region us-east-1 --filters "Name=description,Values=*eks*bootcamp-dev*" --query "NetworkInterfaces[].{ID:NetworkInterfaceId,Description:Description}" --output text)

if [ ! -z "$ORPHANED_ENIS" ]; then
  echo "⚠️ Found orphaned network interfaces:"
  echo "$ORPHANED_ENIS"
  echo "⚠️ These may need manual cleanup if they persist"
else
  echo "✅ No orphaned network interfaces found"
fi
```

### Step 6.4: Check for Orphaned EBS Volumes

```bash
echo "=== Checking for Orphaned EBS Volumes ==="

# List volumes that might be related to the cluster
ORPHANED_VOLUMES=$(aws ec2 describe-volumes --region us-east-1 --filters "Name=tag:kubernetes.io/cluster/routeclouds-prod-cluster,Values=owned" --query "Volumes[].{ID:VolumeId,State:State}" --output text)

if [ ! -z "$ORPHANED_VOLUMES" ]; then
  echo "⚠️ Found orphaned EBS volumes:"
  echo "$ORPHANED_VOLUMES"
  echo "⚠️ These may need manual cleanup if they persist"
else
  echo "✅ No orphaned EBS volumes found"
fi
```

## Troubleshooting Common Deletion Issues

### Issue 1: Terraform Destroy Interrupted

**Symptoms:**
- `terraform destroy` was interrupted (Ctrl+C)
- Resources partially deleted
- State file inconsistencies
- Orphaned AWS resources

**Solution:**
```bash
# Step 1: Refresh Terraform state
terraform refresh

# Step 2: Check what resources remain
terraform state list

# Step 3: Try targeted cleanup
terraform destroy -target=module.eks.module.eks_managed_node_group["example"] -auto-approve
terraform destroy -target=module.eks.aws_eks_cluster.this[0] -auto-approve

# Step 4: Remove problematic resources from state if they're already deleted
terraform state rm module.eks.aws_eks_cluster.this[0]

# Step 5: Continue with destroy
terraform destroy -auto-approve
```

### Issue 2: Stuck Load Balancer Deletion

**Symptoms:**
- ALB not deleted after ingress removal
- Target groups remain attached
- Security groups cannot be deleted

**Solution:**
```bash
# Force delete ALB and target groups
ALB_ARN=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `k8s-3tierapp`)].LoadBalancerArn' --output text)

if [ ! -z "$ALB_ARN" ]; then
  # Delete target groups first
  TARGET_GROUPS=$(aws elbv2 describe-target-groups --load-balancer-arn $ALB_ARN --query 'TargetGroups[].TargetGroupArn' --output text)
  for tg in $TARGET_GROUPS; do
    aws elbv2 delete-target-group --target-group-arn $tg
  done

  # Delete the load balancer
  aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN
fi
```

### Issue 3: Stuck Security Groups

**Symptoms:**
- Security groups cannot be deleted due to dependencies
- ENIs still attached to security groups

**Solution:**
```bash
# Find and clean up ENIs using the security group
SG_ID="sg-12345abcdef"  # Replace with actual security group ID
ENIs=$(aws ec2 describe-network-interfaces --filters "Name=group-id,Values=$SG_ID" --query "NetworkInterfaces[].NetworkInterfaceId" --output text)

for eni in $ENIs; do
  # Check if ENI is attached
  ATTACHMENT=$(aws ec2 describe-network-interfaces --network-interface-ids $eni --query "NetworkInterfaces[0].Attachment.AttachmentId" --output text)

  if [ "$ATTACHMENT" != "None" ] && [ "$ATTACHMENT" != "null" ]; then
    # Detach ENI
    aws ec2 detach-network-interface --attachment-id $ATTACHMENT --force
    sleep 10
  fi

  # Delete ENI
  aws ec2 delete-network-interface --network-interface-id $eni
done

# Now try to delete the security group
aws ec2 delete-security-group --group-id $SG_ID
```

### Issue 4: Node Group Creation Failure During Cleanup

**Symptoms:**
- Node groups fail to delete properly
- Unhealthy nodes in the cluster

**Solution:**
```bash
# Force delete node groups
NODE_GROUPS=$(aws eks list-nodegroups --cluster-name routeclouds-prod-cluster --region us-east-1 --query 'nodegroups' --output text)

for ng in $NODE_GROUPS; do
  echo "Force deleting node group: $ng"
  aws eks delete-nodegroup --cluster-name routeclouds-prod-cluster --nodegroup-name $ng --region us-east-1
done

# Monitor deletion progress
while [ ! -z "$(aws eks list-nodegroups --cluster-name routeclouds-prod-cluster --region us-east-1 --query 'nodegroups' --output text)" ]; do
  echo "⏳ Waiting for node groups to be deleted..."
  sleep 30
done
```

## Regional Considerations

### Migration Impact on Deletion

If you migrated from ap-south-1 to us-east-1, ensure cleanup in the correct region:

```bash
# Check both regions for resources
echo "=== Checking ap-south-1 for remaining resources ==="
aws eks list-clusters --region ap-south-1
aws rds describe-db-instances --region ap-south-1 --query 'DBInstances[?contains(DBInstanceIdentifier,`routeclouds-prod-db`)]'

echo "=== Checking us-east-1 for remaining resources ==="
aws eks list-clusters --region us-east-1
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier,`routeclouds-prod-db`)]'
```

### Region-Specific Cleanup Commands

```bash
# Set the correct region for cleanup
export AWS_DEFAULT_REGION=us-east-1

# Verify region in all AWS CLI commands
aws configure get region

# Update kubectl context for correct region
aws eks update-kubeconfig --region us-east-1 --name routeclouds-prod-cluster
```

## Final Verification and Cost Optimization

### Step 1: Comprehensive Resource Check

```bash
echo "=== Final Comprehensive Resource Check ==="

# Check for resources with cluster tags
aws resourcegroupstaggingapi get-resources --tag-filters Key=kubernetes.io/cluster/routeclouds-prod-cluster,Values=owned --region us-east-1

# Check for resources with project tags
aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=RouteClouds-Repo --region us-east-1

# Check for any remaining EKS resources
aws eks list-clusters --region us-east-1

# Check for any remaining RDS resources
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[].DBInstanceIdentifier'

# Check for any remaining VPCs (should only show default)
aws ec2 describe-vpcs --region us-east-1 --query 'Vpcs[].{VpcId:VpcId,IsDefault:IsDefault,State:State}'

# Check for any remaining load balancers
aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[].LoadBalancerName'
```

### Step 2: Cost Verification

```bash
echo "=== Cost Verification Steps ==="

echo "1. Check AWS Billing Dashboard for the following services:"
echo "   - Amazon EKS"
echo "   - Amazon RDS"
echo "   - Amazon EC2"
echo "   - Elastic Load Balancing"
echo "   - Amazon VPC"

echo "2. Verify no ongoing charges for:"
echo "   - EKS cluster hours"
echo "   - RDS instance hours"
echo "   - EC2 instance hours"
echo "   - Load balancer hours"
echo "   - NAT Gateway hours"

echo "3. Check for any remaining snapshots or backups that may incur storage costs"
```

### Step 3: Documentation and Cleanup

```bash
echo "=== Final Documentation and Cleanup ==="

# Create final deletion report
cat > deletion-completion-report.txt << EOF
3-Tier Application Deletion Completion Report
============================================
Date: $(date)
Region: us-east-1
Cluster Name: routeclouds-prod-cluster

Deletion Status:
- Application Resources: ✅ Deleted
- Kubernetes Infrastructure: ✅ Deleted
- AWS Load Balancers: ✅ Deleted
- EKS Cluster: ✅ Deleted
- RDS Instance: ✅ Deleted
- VPC and Networking: ✅ Deleted
- IAM Resources: ✅ Deleted
- Terraform State: ✅ Clean

Next Steps:
1. Monitor AWS billing for 24-48 hours to ensure no unexpected charges
2. Archive project files for future reference
3. Update team documentation about infrastructure deletion
EOF

echo "✅ Deletion process completed successfully!"
echo "📄 Check deletion-completion-report.txt for summary"
echo "💰 Monitor AWS billing dashboard for cost verification"
```

## Important Notes and Best Practices

### Critical Reminders

1. **Data Backup**: Always backup critical data before starting deletion process
2. **Cost Monitoring**: Monitor AWS billing for 24-48 hours after deletion
3. **Team Communication**: Notify team members before infrastructure deletion
4. **Documentation**: Keep deletion logs for audit and troubleshooting purposes
5. **Regional Awareness**: Ensure cleanup in the correct AWS region

### Prevention Strategies

1. **Use Infrastructure as Code**: Always use Terraform for reproducible infrastructure
2. **Implement Proper Tagging**: Tag all resources for easy identification and cleanup
3. **Regular Cleanup**: Implement regular cleanup schedules for development environments
4. **Cost Alerts**: Set up AWS billing alerts to catch orphaned resources
5. **Automation**: Consider automating cleanup processes for development environments

### Emergency Contacts

- **AWS Support**: For critical issues during deletion
- **Team Lead**: For approval of manual resource deletion
- **DevOps Team**: For Terraform and infrastructure issues

---

**⚠️ Final Warning**: This deletion process will permanently remove all infrastructure and data. Ensure you have proper backups and approvals before proceeding.

By following this comprehensive deletion guide, you can ensure that all resources created for the 3-tier application are properly cleaned up, preventing orphaned resources and unnecessary AWS charges.
