# Complete Project Deletion Process

This document outlines the step-by-step process to completely delete all resources created for the 3-tier application deployment on AWS EKS. Following this guide will ensure that all resources are deleted in the correct order to avoid dependency issues and prevent orphaned resources.

## Table of Contents
1. [Pre-Deletion Checklist](#pre-deletion-checklist)
2. [Phase 1: Application Resources Cleanup](#phase-1-application-resources-cleanup)
3. [Phase 2: Kubernetes Add-ons Cleanup](#phase-2-kubernetes-add-ons-cleanup)
4. [Phase 3: Manual AWS Resources Cleanup](#phase-3-manual-aws-resources-cleanup)
5. [Phase 4: Terraform Infrastructure Destruction](#phase-4-terraform-infrastructure-destruction)
6. [Phase 5: Verification and Final Cleanup](#phase-5-verification-and-final-cleanup)
7. [Troubleshooting](#troubleshooting)

## Pre-Deletion Checklist

Before starting the deletion process, ensure you have:

- [ ] AWS CLI configured with appropriate permissions
- [ ] kubectl configured to access your EKS cluster
- [ ] Terraform installed (same version used for deployment)
- [ ] All deployment files and directories available
- [ ] Backed up any important data from the application or database

## Phase 1: Application Resources Cleanup

### Step 1.1: Delete Ingress Resources
```bash
# Navigate to k8s directory
cd 3-tier-app-eks/k8s/

# Delete ingress resources
kubectl delete -f ingress.yaml

# Verify ingress deletion
kubectl get ingress -n 3-tier-app-eks

# If ingress is stuck in deletion, force remove it
kubectl patch ingress 3-tier-app-ingress -n 3-tier-app-eks -p '{"metadata":{"finalizers":[]}}' --type=merge
kubectl delete ingress 3-tier-app-ingress -n 3-tier-app-eks --grace-period=0 --force
```

### Step 1.2: Delete Application Deployments
```bash
# Delete frontend deployment and service
kubectl delete -f frontend.yaml

# Delete backend deployment and service
kubectl delete -f backend.yaml

# Verify deployments and services are deleted
kubectl get deployments,svc -n 3-tier-app-eks
```

### Step 1.3: Delete Database Resources
```bash
# Delete database migration job
kubectl delete -f migration_job.yaml

# Delete database service
kubectl delete -f database-service.yaml

# Verify database resources are deleted
kubectl get jobs,svc -n 3-tier-app-eks | grep -E 'postgres|database'
```

### Step 1.4: Delete ConfigMaps and Secrets
```bash
# Delete configmaps
kubectl delete -f configmap.yaml

# Delete secrets
kubectl delete -f secrets.yaml

# Verify configmaps and secrets are deleted
kubectl get configmaps,secrets -n 3-tier-app-eks
```

### Step 1.5: Delete Namespace
```bash
# Delete namespace (this will delete any remaining resources in the namespace)
kubectl delete -f namespace.yaml

# Verify namespace deletion
kubectl get namespace 3-tier-app-eks

# If namespace is stuck in "Terminating" state, force remove it
kubectl get namespace 3-tier-app-eks -o json | \
  jq '.spec.finalizers = []' | \
  kubectl replace --raw "/api/v1/namespaces/3-tier-app-eks/finalize" -f -
```

### Step 1.6: Delete Horizontal Pod Autoscalers (if created)
```bash
# Delete HPA resources
kubectl delete -f hpa.yaml

# Verify HPA deletion
kubectl get hpa -n 3-tier-app-eks
```

## Phase 2: Kubernetes Add-ons Cleanup

### Step 2.1: Uninstall AWS Load Balancer Controller
```bash
# Uninstall ALB controller using Helm
helm uninstall aws-load-balancer-controller -n kube-system

# Verify ALB controller is uninstalled
kubectl get deployment -n kube-system aws-load-balancer-controller

# Delete the ALB controller service account
kubectl delete serviceaccount aws-load-balancer-controller -n kube-system
```

### Step 2.2: Delete IAM Service Account
```bash
# Delete the IAM service account
eksctl delete iamserviceaccount \
  --cluster=bootcamp-dev-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller

# Verify service account deletion
eksctl get iamserviceaccount --cluster bootcamp-dev-cluster
```

### Step 2.3: Delete IAM Policy for ALB Controller
```bash
# Get the policy ARN
POLICY_ARN=$(aws iam list-policies --query 'Policies[?PolicyName==`AWSLoadBalancerControllerIAMPolicy`].Arn' --output text)

# Delete the policy
aws iam delete-policy --policy-arn $POLICY_ARN

# Verify policy deletion
aws iam list-policies --query 'Policies[?PolicyName==`AWSLoadBalancerControllerIAMPolicy`].Arn' --output text
```

## Phase 3: Manual AWS Resources Cleanup

### Step 3.1: Delete Route53 Records (if created)
```bash
# Get the hosted zone ID
ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='yourdomain.com.'].Id" --output text | sed 's/\/hostedzone\///')

# Delete the A record for your application
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "app.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z32O12XQLNTSW2",
          "DNSName": "your-alb-dns-name.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Verify record deletion
aws route53 list-resource-record-sets --hosted-zone-id $ZONE_ID --query "ResourceRecordSets[?Name=='app.yourdomain.com.']"
```

### Step 3.2: Delete ACM Certificates (if created)
```bash
# List certificates
aws acm list-certificates --region us-east-1

# Delete certificate
aws acm delete-certificate --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/your-certificate-id --region us-east-1

# Verify certificate deletion
aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='app.yourdomain.com']"
```

### Step 3.3: Delete IAM Role for GitHub Actions OIDC (if created manually)
```bash
# Get the role ARN
ROLE_ARN=$(aws iam list-roles --query "Roles[?RoleName=='GitHubActionsEKSDeployRole'].Arn" --output text)

# List attached policies
POLICIES=$(aws iam list-attached-role-policies --role-name GitHubActionsEKSDeployRole --query "AttachedPolicies[*].PolicyArn" --output text)

# Detach policies
for policy in $POLICIES; do
  aws iam detach-role-policy --role-name GitHubActionsEKSDeployRole --policy-arn $policy
done

# Delete the role
aws iam delete-role --role-name GitHubActionsEKSDeployRole

# Verify role deletion
aws iam list-roles --query "Roles[?RoleName=='GitHubActionsEKSDeployRole'].Arn" --output text
```

### Step 3.4: Delete OIDC Provider (if created manually)
```bash
# Get OIDC provider ARN
OIDC_ARN=$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'oidc.eks.us-east-1.amazonaws.com')].Arn" --output text)

# Delete OIDC provider
aws iam delete-open-id-connect-provider --open-id-connect-provider-arn $OIDC_ARN

# Verify OIDC provider deletion
aws iam list-open-id-connect-providers
```

### Step 3.5: Check for Orphaned Load Balancers
```bash
# List load balancers
aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[?contains(LoadBalancerName,`k8s-3tierapp`)].{Name:LoadBalancerName,DNS:DNSName}'

# Delete any orphaned load balancers
aws elbv2 delete-load-balancer --load-balancer-arn your-load-balancer-arn

# Verify load balancer deletion
aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[?contains(LoadBalancerName,`k8s-3tierapp`)].{Name:LoadBalancerName,DNS:DNSName}'
```

### Step 3.6: Check for Orphaned Security Groups
```bash
# Get VPC ID
VPC_ID=$(aws eks describe-cluster --name bootcamp-dev-cluster --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)

# List security groups in the VPC
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[?GroupName!='default'].{ID:GroupId,Name:GroupName}"

# Delete any orphaned security groups (be careful!)
# aws ec2 delete-security-group --group-id sg-12345abcdef
```

## Phase 4: Terraform Infrastructure Destruction

### Step 4.1: Prepare for Terraform Destroy
```bash
# Navigate to infrastructure directory
cd ../infra/

# Initialize Terraform
terraform init

# Refresh Terraform state
terraform refresh
```

### Step 4.2: Destroy Infrastructure in Reverse Order
```bash
# First destroy node groups (if they're causing issues)
terraform destroy -target=module.eks.module.eks_managed_node_group["one"] -auto-approve

# Then destroy EKS cluster
terraform destroy -target=module.eks -auto-approve

# Then destroy RDS
terraform destroy -target=module.rds -auto-approve

# Finally destroy everything else
terraform destroy -auto-approve
```

### Step 4.3: Verify Terraform Destruction
```bash
# Check if any resources still exist in Terraform state
terraform state list

# If resources remain, try targeted destroy again
# terraform destroy -target=resource_type.resource_name
```

## Phase 5: Verification and Final Cleanup

### Step 5.1: Verify EKS Cluster Deletion
```bash
# Check if EKS cluster still exists
aws eks list-clusters --region us-east-1

# If cluster still exists, force delete it
aws eks delete-cluster --name bootcamp-dev-cluster --region us-east-1
```

### Step 5.2: Verify RDS Instance Deletion
```bash
# Check if RDS instance still exists
aws rds describe-db-instances --region us-east-1 --query "DBInstances[?contains(DBInstanceIdentifier, 'bootcamp-dev-db')].DBInstanceIdentifier"

# If instance still exists, force delete it (WARNING: This will delete all data!)
aws rds delete-db-instance \
  --db-instance-identifier bootcamp-dev-db \
  --skip-final-snapshot \
  --delete-automated-backups \
  --region us-east-1
```

### Step 5.3: Check for Orphaned ENIs
```bash
# List network interfaces that might be related to the cluster
aws ec2 describe-network-interfaces --region us-east-1 --filters "Name=description,Values=*eks*bootcamp-dev*" --query "NetworkInterfaces[].{ID:NetworkInterfaceId,Description:Description}"

# Delete orphaned ENIs if necessary
# aws ec2 delete-network-interface --network-interface-id eni-12345abcdef
```

### Step 5.4: Check for Orphaned EBS Volumes
```bash
# List volumes that might be related to the cluster
aws ec2 describe-volumes --region us-east-1 --filters "Name=tag:kubernetes.io/cluster/bootcamp-dev-cluster,Values=owned" --query "Volumes[].{ID:VolumeId,State:State}"

# Delete orphaned volumes if necessary
# aws ec2 delete-volume --volume-id vol-12345abcdef
```

### Step 5.5: Final AWS Resource Check
```bash
# Check for resources with the cluster tag
aws resourcegroupstaggingapi get-resources --tag-filters Key=kubernetes.io/cluster/bootcamp-dev-cluster,Values=owned --region us-east-1

# Check for resources with the project tag
aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=DevOpsDojo --region us-east-1
```

## Troubleshooting

### Stuck Namespace
If a namespace is stuck in "Terminating" state:
```bash
kubectl get namespace 3-tier-app-eks -o json | \
  jq '.spec.finalizers = []' | \
  kubectl replace --raw "/api/v1/namespaces/3-tier-app-eks/finalize" -f -
```

### Stuck Load Balancer
If AWS Load Balancer Controller is not cleaning up ALBs:
```bash
# Find the ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[?contains(LoadBalancerName,`k8s-3tierapp`)].LoadBalancerArn' --output text)

# Find and delete target groups
TARGET_GROUPS=$(aws elbv2 describe-target-groups --region us-east-1 --query 'TargetGroups[?contains(TargetGroupName,`k8s-3tierapp`)].TargetGroupArn' --output text)
for tg in $TARGET_GROUPS; do
  aws elbv2 delete-target-group --target-group-arn $tg
done

# Delete the load balancer
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN
```

### Stuck Security Groups
If security groups cannot be deleted due to dependencies:
```bash
# Find ENIs using the security group
SG_ID="sg-12345abcdef"
ENIs=$(aws ec2 describe-network-interfaces --filters "Name=group-id,Values=$SG_ID" --query "NetworkInterfaces[].NetworkInterfaceId" --output text)

# Detach and delete ENIs
for eni in $ENIs; do
  ATTACHMENT=$(aws ec2 describe-network-interfaces --network-interface-ids $eni --query "NetworkInterfaces[0].Attachment.AttachmentId" --output text)
  if [ "$ATTACHMENT" != "None" ] && [ "$ATTACHMENT" != "null" ]; then
    aws ec2 detach-network-interface --attachment-id $ATTACHMENT --force
    sleep 10
  fi
  aws ec2 delete-network-interface --network-interface-id $eni
done

# Now try to delete the security group again
aws ec2 delete-security-group --group-id $SG_ID
```

### Terraform State Issues
If Terraform state is inconsistent with actual resources:
```bash
# Remove resource from state
terraform state rm module.eks.aws_eks_cluster.this[0]

# Or import existing resource to state
terraform import module.eks.aws_eks_cluster.this[0] bootcamp-dev-cluster
```

---

## Important Notes

1. **Backup Data**: Before deletion, ensure you have backed up any important data from the RDS database.

2. **Cost Verification**: After completing the deletion process, verify in the AWS Billing dashboard that all billable resources have been terminated.

3. **IAM Cleanup**: Double-check that all IAM roles, policies, and service accounts created for this project have been deleted.

4. **DNS Records**: Ensure all DNS records pointing to deleted resources are removed to prevent future confusion.

5. **Local Files**: After successful deletion, you may want to archive the project files for future reference.

By following this comprehensive deletion process, you can ensure that all resources created for the 3-tier application are properly cleaned up, preventing orphaned resources and unnecessary AWS charges.