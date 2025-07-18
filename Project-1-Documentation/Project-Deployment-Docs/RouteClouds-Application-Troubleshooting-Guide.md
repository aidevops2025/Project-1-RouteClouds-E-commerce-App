# 3-Tier Application Troubleshooting Guide (AWS EKS)

**Comprehensive Troubleshooting Guide for DevOps Learning Platform**

---

## Table of Contents

### Infrastructure Troubleshooting
1. [EKS Cluster and Node Issues](#eks-cluster-and-node-issues)
2. [Terraform Module and Version Conflicts](#terraform-module-and-version-conflicts)
3. [Network and Security Group Issues](#network-and-security-group-issues)
4. [RDS Database Connectivity Issues](#rds-database-connectivity-issues)

### Application Troubleshooting
5. [Backend Pod CrashLoopBackOff - File Path Mismatch](#backend-pod-crashloopbackoff---file-path-mismatch-issue)
6. [Pod Deployment and Startup Issues](#pod-deployment-and-startup-issues)
7. [Database Credential Synchronization](#database-credential-synchronization)
8. [Load Balancer and Ingress Issues](#load-balancer-and-ingress-issues)
   - [AWS Load Balancer Controller IAM Permission Issues](#aws-load-balancer-controller-iam-permission-issues)
9. [Application Performance Issues](#application-performance-issues)

### Operational Troubleshooting
10. [CI/CD Pipeline Issues](#cicd-pipeline-issues)
11. [Resource Cleanup and Deletion Issues](#resource-cleanup-and-deletion-issues)
12. [Monitoring and Logging Issues](#monitoring-and-logging-issues)
13. [Security and Access Issues](#security-and-access-issues)

### Diagnostic Tools and Scripts
14. [Essential Troubleshooting Commands](#essential-troubleshooting-commands)
15. [Automated Diagnostic Scripts](#automated-diagnostic-scripts)
16. [Troubleshooting Decision Trees](#troubleshooting-decision-trees)

---

## Backend Pod CrashLoopBackOff - File Path Mismatch Issue

### Issue Description
**Problem**: Backend pods fail to start and enter `CrashLoopBackOff` status
**Symptoms**:
- Deployment shows `0/2` ready pods
- Pods restart repeatedly
- Error in logs: `Cannot find module '/app/dist/server.js'`

### Root Cause Analysis

**Error Message**:
```
Error: Cannot find module '/app/dist/server.js'
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1039:15)
    at Function.Module._load (node:internal/modules/cjs/loader:885:27)
    at Function.executeUserEntryPoint [as runMain] (node:internal/process/execution:124:12)
    at node:internal/main/run_main_module:23:47
```

**Root Cause**:
- The `package.json` start script references `dist/server.js`
- The actual TypeScript source file is `src/index.ts`
- When compiled, it becomes `dist/index.js`, not `dist/server.js`
- File path mismatch causes module not found error

### Diagnostic Steps

1. **Check Pod Status**:
   ```bash
   kubectl get pods -n routeclouds-ns -o wide
   ```
   Expected output showing CrashLoopBackOff:
   ```
   NAME                      READY   STATUS             RESTARTS   AGE
   backend-xxx-xxx           0/1     CrashLoopBackOff   5          5m
   ```

2. **Check Pod Logs**:
   ```bash
   kubectl logs <pod-name> -n routeclouds-ns --tail=20
   ```
   Look for "Cannot find module" errors

3. **Verify Package.json Configuration**:
   ```bash
   # Check the start script in package.json
   cat backend/package.json | grep -A 5 "scripts"
   ```

4. **Verify Source File Structure**:
   ```bash
   # Check what files exist in src directory
   ls -la backend/src/
   # Check what gets compiled to dist
   ls -la backend/dist/ (if available)
   ```

### Solution Steps

#### Step 1: Fix Package.json Start Script

**Current (Incorrect)**:
```json
{
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts"
  }
}
```

**Fixed (Correct)**:
```json
{
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts"
  }
}
```

**Commands to Fix**:
```bash
# Navigate to backend directory
cd backend

# Update package.json (manual edit or script)
# Fix the main entry point and start script
sed -i 's/dist\/server\.js/dist\/index\.js/g' package.json
sed -i 's/src\/server\.ts/src\/index\.ts/g' package.json
```

#### Step 2: Rebuild Docker Image

```bash
# Build new image with fixes
docker build -t awsfreetier30/routeclouds-backend:latest .

# Test the image locally (optional)
docker run --rm awsfreetier30/routeclouds-backend:latest npm run --version

# Push to Docker Hub
docker push awsfreetier30/routeclouds-backend:latest
```

#### Step 3: Restart Kubernetes Deployment

```bash
# Force restart deployment to pull new image
kubectl rollout restart deployment/backend -n routeclouds-ns

# Monitor the rollout
kubectl rollout status deployment/backend -n routeclouds-ns

# Verify pods are running
kubectl get pods -n routeclouds-ns
```

#### Step 4: Verify Fix

```bash
# Check pod status (should show Running)
kubectl get pods -n routeclouds-ns

# Check logs for successful startup
kubectl logs -l app=backend -n routeclouds-ns --tail=10

# Test application endpoint
kubectl port-forward svc/backend 8000:8000 -n routeclouds-ns &
curl http://localhost:8000/api/hello
```

### Prevention Measures

1. **Consistent Naming Convention**:
   - Use consistent file naming (e.g., always use `index.ts` as entry point)
   - Ensure package.json scripts match actual file structure

2. **Local Testing**:
   ```bash
   # Always test Docker build locally before pushing
   docker build -t test-backend .
   docker run --rm test-backend npm start
   ```

3. **CI/CD Validation**:
   - Add build verification steps in GitHub Actions
   - Test container startup before deployment

4. **Documentation**:
   - Document file structure and naming conventions
   - Keep package.json scripts synchronized with actual files

### Related Issues

- **TypeScript Compilation Errors**: Ensure `tsconfig.json` output directory matches package.json paths
- **Missing Dependencies**: Verify all required packages are in package.json
- **Environment Variables**: Check if application requires specific env vars to start

### Quick Fix Commands

```bash
# One-liner to fix and redeploy
cd backend && \
sed -i 's/dist\/server\.js/dist\/index\.js/g' package.json && \
docker build -t awsfreetier30/routeclouds-backend:latest . && \
docker push awsfreetier30/routeclouds-backend:latest && \
kubectl rollout restart deployment/backend -n routeclouds-ns
```

### Success Indicators

✅ **Fixed Successfully When**:
- Pods show `Running` status with `1/1` ready
- Deployment shows `2/2` ready pods
- Logs show application startup messages instead of module errors
- Health check endpoints respond correctly
- No restart loops in pod status

---

## EKS Cluster and Node Issues

### Issue 1: EKS Nodes Not Joining Cluster

#### Symptoms
- Nodes show as "NotReady" in `kubectl get nodes`
- Cloud-init warnings about unhandled EKS userdata
- Node group creation fails or times out
- Pods stuck in "Pending" state

#### Root Cause Analysis
**Primary Issue**: Missing or misconfigured EKS add-ons, particularly VPC CNI

**Why This Causes Node Failure:**
1. **VPC CNI Missing**: Without VPC CNI add-on, nodes cannot configure networking
2. **Bootstrap Failure**: cloud-init cannot complete EKS bootstrap process
3. **Cluster Communication**: Nodes cannot establish communication with control plane
4. **Health Check Failure**: EKS health checks fail due to network issues

#### Diagnostic Commands
```bash
# Check node status
kubectl get nodes -o wide

# Check node group status
aws eks describe-nodegroup --cluster-name routeclouds-prod-cluster --nodegroup-name example

# Check add-ons status
aws eks list-addons --cluster-name routeclouds-prod-cluster
aws eks describe-addon --cluster-name routeclouds-prod-cluster --addon-name vpc-cni

# Check node logs (if accessible)
aws ec2 describe-instances --filters "Name=tag:eks:cluster-name,Values=routeclouds-prod-cluster"
```

#### Solution Implementation

**Step 1: Enhanced Add-on Configuration**
```hcl
# In eks.tf
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

**Step 2: Clean Up Failed Resources**
```bash
# Destroy failed node groups
terraform destroy -target=module.eks.module.eks_managed_node_group -auto-approve

# Wait for cleanup to complete
aws eks describe-nodegroup --cluster-name routeclouds-prod-cluster --nodegroup-name example
```

**Step 3: Redeploy with Fixed Configuration**
```bash
# Apply the enhanced configuration
terraform apply -target=module.eks -auto-approve

# Verify add-ons are installed
aws eks list-addons --cluster-name routeclouds-prod-cluster

# Check node status
kubectl get nodes
```

#### Verification Steps
```bash
# Verify all add-ons are active
aws eks describe-addon --cluster-name routeclouds-prod-cluster --addon-name vpc-cni
aws eks describe-addon --cluster-name routeclouds-prod-cluster --addon-name coredns
aws eks describe-addon --cluster-name routeclouds-prod-cluster --addon-name kube-proxy

# Check node readiness
kubectl get nodes -o wide

# Verify pod networking
kubectl run test-pod --image=nginx --rm -it -- /bin/bash
```

### Issue 2: Node Group Scaling Issues

#### Symptoms
- Desired capacity not matching actual running instances
- Nodes not scaling up despite resource demands
- Auto Scaling Group shows different count than EKS

#### Root Cause Analysis
- Minimum size greater than desired size
- Insufficient subnet capacity
- Instance type not available in selected AZs
- IAM permissions issues

#### Diagnostic Commands
```bash
# Check node group configuration
aws eks describe-nodegroup --cluster-name routeclouds-prod-cluster --nodegroup-name example

# Check Auto Scaling Group
ASG_NAME=$(aws eks describe-nodegroup --cluster-name routeclouds-prod-cluster --nodegroup-name example --query 'nodegroup.resources.autoScalingGroups[0].name' --output text)
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG_NAME

# Check EC2 instances
aws ec2 describe-instances --filters "Name=tag:eks:cluster-name,Values=routeclouds-prod-cluster" --query 'Reservations[].Instances[].{InstanceId:InstanceId,State:State.Name,Type:InstanceType,AZ:Placement.AvailabilityZone}'
```

#### Solution Implementation
```bash
# Update node group scaling configuration
aws eks update-nodegroup-config \
    --cluster-name routeclouds-prod-cluster \
    --nodegroup-name example \
    --scaling-config minSize=2,maxSize=4,desiredSize=2

# Or update via Terraform
# In eks.tf, ensure:
# min_size     = 2
# max_size     = 4
# desired_size = 2
```

---

## Terraform Module and Version Conflicts

### Issue 1: EKS Module Version Compatibility

#### Symptoms
```
Error: Unsupported block type
  on .terraform/modules/eks/modules/eks-managed-node-group/main.tf line 140:
  140:   dynamic "elastic_gpu_specifications" {
Blocks of type "elastic_gpu_specifications" are not expected here.
```

#### Root Cause Analysis
- EKS module version incompatible with AWS provider version
- Terraform version conflicts
- Module includes deprecated or unsupported resource blocks

#### Solution Implementation
```hcl
# In eks.tf, update module version
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.31"  # Use compatible version instead of 20.33.1
  
  # ... rest of configuration
}
```

#### Verification Steps
```bash
# Clean Terraform cache
rm -rf .terraform/
terraform init

# Verify no errors
terraform plan
```

### Issue 2: Provider Version Conflicts

#### Symptoms
- Resource blocks not recognized
- API version mismatches
- Deprecated argument warnings

#### Solution Implementation
```hcl
# In providers.tf or versions.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0"
}
```

---

## Network and Security Group Issues

### Issue 1: ALB Not Creating Due to Subnet Tags

#### Symptoms
- Ingress shows no ADDRESS after several minutes
- ALB controller logs show subnet discovery errors
- Load balancer creation fails

#### Root Cause Analysis
- Public subnets missing `kubernetes.io/role/elb=1` tag
- Private subnets missing `kubernetes.io/role/internal-elb=1` tag
- Insufficient subnets across availability zones

#### Diagnostic Commands
```bash
# Get VPC ID
VPC_ID=$(aws eks describe-cluster --name routeclouds-prod-cluster --query 'cluster.resourcesVpcConfig.vpcId' --output text)

# Check subnet tags
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].{SubnetId:SubnetId,Tags:Tags,AZ:AvailabilityZone}'

# Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller
```

#### Solution Implementation
```bash
# Get public and private subnets
PUBLIC_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=true" --query 'Subnets[].SubnetId' --output text)
PRIVATE_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=false" --query 'Subnets[].SubnetId' --output text)

# Tag public subnets for ALB
for subnet in $PUBLIC_SUBNETS; do
    aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/elb,Value=1
done

# Tag private subnets for internal ELB
for subnet in $PRIVATE_SUBNETS; do
    aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/internal-elb,Value=1
done
```

### Issue 2: Security Group Rules Blocking Traffic

#### Symptoms
- Pods cannot reach external services
- Database connections fail
- Inter-pod communication issues

#### Diagnostic Commands
```bash
# Check security groups
aws ec2 describe-security-groups --filters "Name=group-name,Values=*bootcamp*"

# Test connectivity from pod
kubectl run debug-pod --rm -it --image=busybox -- /bin/sh
# Inside pod: nslookup google.com
# Inside pod: telnet <database-host> 5432
```

---

## RDS Database Connectivity Issues

### Issue 1: Database Connection Timeouts

#### Symptoms
- Applications cannot connect to RDS
- Connection timeout errors
- DNS resolution failures for database service

#### Root Cause Analysis
- Security group rules blocking port 5432
- RDS instance in wrong subnet group
- ExternalName service misconfiguration
- Network ACLs blocking traffic

#### Diagnostic Commands
```bash
# Check RDS instance status
aws rds describe-db-instances --db-instance-identifier routeclouds-prod-db

# Check security groups
aws rds describe-db-instances --db-instance-identifier routeclouds-prod-db --query 'DBInstances[0].VpcSecurityGroups'

# Test DNS resolution
kubectl run dns-test --rm -it --image=tutum/dnsutils -n routeclouds-ns -- dig postgres-db.routeclouds-ns.svc.cluster.local

# Check ExternalName service
kubectl get svc postgres-db -n routeclouds-ns -o yaml
```

#### Solution Implementation
```bash
# Verify ExternalName service points to correct RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier routeclouds-prod-db --query 'DBInstances[0].Endpoint.Address' --output text)

# Update service if needed
kubectl patch svc postgres-db -n routeclouds-ns -p '{"spec":{"externalName":"'$RDS_ENDPOINT'"}}'

# Test connectivity
kubectl run db-test --rm -it --image=postgres:13 -n routeclouds-ns -- bash
```

### Issue 2: Authentication Failures

#### Symptoms
- `FATAL: password authentication failed for user`
- Connection established but login rejected
- Credential mismatch errors

#### Root Cause Analysis
- Kubernetes secrets contain outdated passwords
- AWS Secrets Manager credentials don't match Kubernetes
- Database user permissions issues

#### Diagnostic Commands
```bash
# Check AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id db/routeclouds-prod-db --region us-east-1 --query SecretString --output text

# Check Kubernetes secret
kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_PASSWORD}' | base64 -d

# Compare credentials
echo "AWS Password: $(aws secretsmanager get-secret-value --secret-id db/routeclouds-prod-db --region us-east-1 --query SecretString --output text | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')"
echo "K8s Password: $(kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)"
```

#### Solution Implementation
```bash
# Run automated credential synchronization
./k8s/update-db-secrets.sh

# Or manual sync:
SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id db/routeclouds-prod-db --region us-east-1 --query SecretString --output text)
DB_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Update Kubernetes secret
kubectl patch secret db-secrets -n routeclouds-ns --type='merge' -p="{\"data\":{\"DB_PASSWORD\":\"$(echo -n "$DB_PASSWORD" | base64 -w 0)\"}}"
```

---

## Pod Deployment and Startup Issues

### Issue 1: Pods Stuck in Pending State

#### Symptoms
- Pods remain in "Pending" status
- No nodes available for scheduling
- Resource constraints preventing scheduling

#### Diagnostic Commands
```bash
# Check pod status and events
kubectl get pods -n routeclouds-ns
kubectl describe pod <pod-name> -n routeclouds-ns

# Check node resources
kubectl top nodes
kubectl describe nodes

# Check resource requests vs available
kubectl get pods -n routeclouds-ns -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].resources.requests}{"\n"}{end}'
```

#### Solution Implementation
```bash
# Scale up node group if needed
aws eks update-nodegroup-config \
    --cluster-name routeclouds-prod-cluster \
    --nodegroup-name example \
    --scaling-config desiredSize=3

# Or adjust resource requests
kubectl patch deployment backend -n routeclouds-ns -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"requests":{"cpu":"100m","memory":"128Mi"}}}]}}}}'
```

### Issue 2: Image Pull Errors

#### Symptoms
- `ErrImagePull` or `ImagePullBackOff` status
- Cannot pull container images
- Authentication failures to ECR

#### Diagnostic Commands
```bash
# Check pod events
kubectl describe pod <pod-name> -n routeclouds-ns

# Check image exists
aws ecr describe-images --repository-name <repo-name> --region us-east-1

# Test ECR authentication
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
```

#### Solution Implementation
```bash
# Update image tag in deployment
kubectl set image deployment/backend backend=<account-id>.dkr.ecr.us-east-1.amazonaws.com/backend:latest -n routeclouds-ns

# Or use public images for testing
kubectl set image deployment/backend backend=nginx:latest -n routeclouds-ns
```

### Issue 3: Application Startup Failures

#### Symptoms
- Pods start but application doesn't respond
- Health check failures
- CrashLoopBackOff status

#### Diagnostic Commands
```bash
# Check application logs
kubectl logs -n routeclouds-ns -l app=backend --tail=50
kubectl logs -n routeclouds-ns -l app=frontend --tail=50

# Check environment variables
kubectl exec -n routeclouds-ns deployment/backend -- env

# Test application endpoints
kubectl port-forward -n routeclouds-ns deployment/backend 8000:8000
curl http://localhost:8000/health
```

#### Solution Implementation
```bash
# Update environment variables
kubectl patch deployment backend -n routeclouds-ns -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","env":[{"name":"DEBUG","value":"true"}]}]}}}}'

# Restart deployment
kubectl rollout restart deployment/backend -n routeclouds-ns
kubectl rollout restart deployment/frontend -n routeclouds-ns
```

---

## Load Balancer and Ingress Issues

### Issue 1: Ingress Stuck in Terminating State

#### Symptoms
- `kubectl delete ingress` hangs indefinitely
- Ingress shows "Terminating" status
- ALB not being deleted

#### Root Cause Analysis
- Finalizers preventing deletion
- ALB controller webhook blocking deletion
- Missing IngressClass causing validation errors

#### Diagnostic Commands
```bash
# Check ingress status
kubectl get ingress -n routeclouds-ns
kubectl describe ingress routeclouds-ingress -n routeclouds-ns

# Check finalizers
kubectl get ingress routeclouds-ingress -n routeclouds-ns -o yaml | grep finalizers

# Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller
```

#### Solution Implementation

**Step 1: Recreate IngressClass (if missing)**
```bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: alb
spec:
  controller: ingress.k8s.aws/alb
EOF
```

**Step 2: Delete Ingress**
```bash
kubectl delete ingress routeclouds-ingress -n routeclouds-ns
```

**Step 3: Clean Up Temporary IngressClass**
```bash
kubectl delete ingressclass alb
```

**Step 4: Verify ALB Deletion**
```bash
aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `k8s-3tierapp`)].{Name:LoadBalancerName,State:State.Code}'
```

### Issue 2: ALB Health Check Failures

#### Symptoms
- ALB shows unhealthy targets
- 502/503 errors from load balancer
- Targets not registering

#### Diagnostic Commands
```bash
# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `k8s-3tierapp`)].LoadBalancerArn' --output text)

# Check target groups
aws elbv2 describe-target-groups --load-balancer-arn $ALB_ARN

# Check target health
TG_ARN=$(aws elbv2 describe-target-groups --load-balancer-arn $ALB_ARN --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 describe-target-health --target-group-arn $TG_ARN
```

#### Solution Implementation
```bash
# Check pod health endpoints
kubectl get pods -n routeclouds-ns -o wide
kubectl exec -n routeclouds-ns deployment/frontend -- curl -I http://localhost:80/
kubectl exec -n routeclouds-ns deployment/backend -- curl -I http://localhost:8000/health

# Update health check path if needed
kubectl annotate ingress routeclouds-ingress -n routeclouds-ns alb.ingress.kubernetes.io/healthcheck-path=/health
```

### AWS Load Balancer Controller IAM Permission Issues

#### Issue 3: DescribeListenerAttributes Permission Denied

#### Symptoms
- Ingress shows repeated `FailedDeployModel` events
- Error message: `AccessDenied: User: arn:aws:sts::ACCOUNT:assumed-role/AmazonEKSLoadBalancerControllerRole/SESSION is not authorized to perform: elasticloadbalancing:DescribeListenerAttributes`
- ALB not being created despite correct ingress configuration
- Ingress remains without an ADDRESS field

#### Root Cause Analysis
The AWS Load Balancer Controller IAM policy is missing the `elasticloadbalancing:DescribeListenerAttributes` permission. This commonly occurs when:

1. **Outdated IAM Policy**: Using an older version of the AWS Load Balancer Controller IAM policy (pre-v2.11.0)
2. **Manual Policy Creation**: Creating IAM policy manually without including all required permissions
3. **Policy Version Mismatch**: The policy was created with an older template but not updated

#### Diagnostic Commands

**Step 1: Check Ingress Events**
```bash
# Check ingress status and events
kubectl describe ingress routeclouds-ingress -n routeclouds-ns

# Look for FailedDeployModel events with DescribeListenerAttributes errors
kubectl get events -n routeclouds-ns --field-selector involvedObject.name=routeclouds-ingress
```

**Step 2: Verify Service Account and IAM Role**
```bash
# Check service account configuration
kubectl get serviceaccount aws-load-balancer-controller -n kube-system -o yaml

# Get the IAM role ARN from the service account
ROLE_ARN=$(kubectl get serviceaccount aws-load-balancer-controller -n kube-system -o jsonpath='{.metadata.annotations.eks\.amazonaws\.com/role-arn}')
echo "IAM Role ARN: $ROLE_ARN"

# Extract role name
ROLE_NAME=$(echo $ROLE_ARN | cut -d'/' -f2)
echo "IAM Role Name: $ROLE_NAME"
```

**Step 3: Check Current IAM Policy Permissions**
```bash
# List attached policies
aws iam list-attached-role-policies --role-name $ROLE_NAME

# Get policy ARN
POLICY_ARN=$(aws iam list-attached-role-policies --role-name $ROLE_NAME --query 'AttachedPolicies[?PolicyName==`AWSLoadBalancerControllerIAMPolicy`].PolicyArn' --output text)

# Check current policy version and permissions
aws iam get-policy-version --policy-arn $POLICY_ARN --version-id v1 --query 'PolicyVersion.Document.Statement[1].Action' --output table

# Search for DescribeListenerAttributes permission
aws iam get-policy-version --policy-arn $POLICY_ARN --version-id v1 --query 'PolicyVersion.Document.Statement[1].Action' --output text | grep -i DescribeListenerAttributes || echo "❌ DescribeListenerAttributes permission NOT found"
```

#### Solution Implementation

**Step 1: Navigate to Policy Directory**
```bash
# Navigate to the directory containing the updated IAM policy
cd /path/to/RouteClouds-E-Comm-Project/k8s/

# Verify the updated policy file exists
ls -la iam_policy.json
```

**Step 2: Update IAM Policy with Latest Permissions**
```bash
# Get current policy ARN
POLICY_ARN=$(aws iam list-policies --query 'Policies[?PolicyName==`AWSLoadBalancerControllerIAMPolicy`].Arn' --output text)

# Create new policy version with updated permissions
aws iam create-policy-version \
    --policy-arn $POLICY_ARN \
    --policy-document file://iam_policy.json \
    --set-as-default

# Verify the new policy version includes DescribeListenerAttributes
aws iam get-policy-version --policy-arn $POLICY_ARN --version-id v3 --query 'PolicyVersion.Document.Statement[1].Action' --output table | grep -i DescribeListenerAttributes
```

**Step 3: Restart AWS Load Balancer Controller**
```bash
# Restart the controller to pick up new permissions
kubectl rollout restart deployment aws-load-balancer-controller -n kube-system

# Wait for controller to be ready
kubectl rollout status deployment aws-load-balancer-controller -n kube-system

# Check controller pods
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
```

**Step 4: Verify Ingress Resolution**
```bash
# Wait 30-60 seconds for the controller to process the ingress
sleep 30

# Check ingress status - should now show ADDRESS
kubectl get ingress routeclouds-ingress -n routeclouds-ns

# Check for successful reconciliation events
kubectl describe ingress routeclouds-ingress -n routeclouds-ns | grep -A 5 -B 5 "Successfully reconciled"

# Verify ALB creation in AWS console or CLI
aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `k8s-routeclo`)].{Name:LoadBalancerName,State:State.Code,DNS:DNSName}'
```

#### Prevention for Future Deployments

**Update Deployment Documentation**
Ensure the main deployment guide uses the local updated `iam_policy.json` file instead of downloading older versions:

```bash
# In deployment scripts, use local file
aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json  # Use local updated file

# Instead of downloading older version
# curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.2/docs/install/iam_policy.json
```

**Policy Version Verification**
Always verify the policy includes required permissions before deployment:

```bash
# Check for required permissions in policy file
grep -i "DescribeListenerAttributes" iam_policy.json || echo "❌ Missing DescribeListenerAttributes permission"
grep -i "DescribeCapacityReservation" iam_policy.json || echo "❌ Missing DescribeCapacityReservation permission"
```

#### Expected Resolution Timeline
- **Policy Update**: Immediate (1-2 minutes)
- **Controller Restart**: 2-3 minutes
- **Ingress Reconciliation**: 1-2 minutes
- **ALB Provisioning**: 3-5 minutes
- **Total Resolution Time**: 5-10 minutes

#### Success Indicators
✅ Ingress shows ADDRESS field populated
✅ Events show "Successfully reconciled" messages
✅ ALB visible in AWS console
✅ No more DescribeListenerAttributes errors
✅ Application accessible via ALB URL

---

## Database Credential Synchronization

### Automated Credential Sync Issues

#### Symptoms
- `update-db-secrets.sh` script fails
- Permission denied errors
- AWS CLI authentication failures

#### Diagnostic Commands
```bash
# Check AWS credentials
aws sts get-caller-identity

# Check script permissions
ls -la k8s/update-db-secrets.sh

# Test AWS Secrets Manager access
aws secretsmanager get-secret-value --secret-id db/routeclouds-prod-db --region us-east-1
```

#### Solution Implementation
```bash
# Fix script permissions
chmod +x k8s/update-db-secrets.sh

# Configure AWS credentials if needed
aws configure

# Run script with debug
bash -x k8s/update-db-secrets.sh
```

### Manual Credential Sync Process

```bash
# Step 1: Get credentials from AWS Secrets Manager
SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id db/routeclouds-prod-db --region us-east-1 --query SecretString --output text)

# Step 2: Parse connection string
DB_USER=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$SECRET_VALUE" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$SECRET_VALUE" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_NAME=$(echo "$SECRET_VALUE" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Step 3: Update Kubernetes secret
kubectl patch secret db-secrets -n routeclouds-ns --type='merge' -p="{
  \"data\": {
    \"DB_HOST\": \"$(echo -n "$DB_HOST" | base64 -w 0)\",
    \"DB_USER\": \"$(echo -n "$DB_USER" | base64 -w 0)\",
    \"DB_PASSWORD\": \"$(echo -n "$DB_PASSWORD" | base64 -w 0)\",
    \"DB_NAME\": \"$(echo -n "$DB_NAME" | base64 -w 0)\",
    \"DATABASE_URL\": \"$(echo -n "$SECRET_VALUE" | base64 -w 0)\"
  }
}"

# Step 4: Verify update
kubectl get secret db-secrets -n routeclouds-ns -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

---

## CI/CD Pipeline Issues

### Issue 1: GitHub Actions OIDC Authentication Failures

#### Symptoms
- GitHub Actions workflow fails at AWS authentication step
- "Unable to assume role" errors
- Permission denied for EKS operations

#### Diagnostic Commands
```bash
# Check OIDC provider exists
aws iam list-open-id-connect-providers

# Check IAM role trust policy
aws iam get-role --role-name GitHubActionsEKSDeployRole

# Verify role policies
aws iam list-attached-role-policies --role-name GitHubActionsEKSDeployRole
```

#### Solution Implementation
```bash
# Recreate OIDC provider if missing
cd infra/aws-oidc-github-cli/
./configure-oidc-github.sh

# Update trust policy for correct repository
aws iam update-assume-role-policy --role-name GitHubActionsEKSDeployRole --policy-document file://trust-policy.json
```

### Issue 2: ECR Push Failures

#### Symptoms
- Docker push fails in GitHub Actions
- ECR authentication errors
- Repository not found errors

#### Solution Implementation
```bash
# Verify ECR repositories exist
aws ecr describe-repositories --region us-east-1

# Create repositories if missing
aws ecr create-repository --repository-name frontend --region us-east-1
aws ecr create-repository --repository-name backend --region us-east-1

# Update GitHub secrets with correct ECR URLs
# ECR_FRONTEND_REPO: <account-id>.dkr.ecr.us-east-1.amazonaws.com/frontend
# ECR_BACKEND_REPO: <account-id>.dkr.ecr.us-east-1.amazonaws.com/backend
```

---

## Resource Cleanup and Deletion Issues

### Issue 1: Terraform Destroy Interrupted

#### Symptoms
- `terraform destroy` was interrupted (Ctrl+C)
- Resources partially deleted
- State file inconsistencies
- Orphaned AWS resources

#### Root Cause Analysis
- Terraform state doesn't match actual AWS resources
- Dependencies prevent clean deletion
- Manual intervention required

#### Diagnostic Commands
```bash
# Check Terraform state
terraform state list

# Check actual AWS resources
aws eks list-clusters --region us-east-1
aws rds describe-db-instances --region us-east-1
aws ec2 describe-vpcs --region us-east-1 --filters "Name=tag:Name,Values=*bootcamp*"

# Compare state vs reality
terraform plan
```

#### Solution Implementation

**Step 1: Refresh Terraform State**
```bash
terraform refresh
```

**Step 2: Targeted Cleanup**
```bash
# Remove specific resources that are causing issues
terraform state rm module.eks.module.eks_managed_node_group["example"]
terraform state rm module.eks.aws_eks_cluster.this[0]

# Try destroying remaining resources
terraform destroy -auto-approve
```

**Step 3: Manual Cleanup (if needed)**
```bash
# Delete EKS cluster manually
aws eks delete-nodegroup --cluster-name routeclouds-prod-cluster --nodegroup-name example
aws eks delete-cluster --name routeclouds-prod-cluster

# Delete RDS instance
aws rds delete-db-instance --db-instance-identifier routeclouds-prod-db --skip-final-snapshot

# Delete VPC and associated resources
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*bootcamp*" --query 'Vpcs[0].VpcId' --output text)
aws ec2 delete-vpc --vpc-id $VPC_ID
```

### Issue 2: Stuck Load Balancer Deletion

#### Symptoms
- ALB not deleted after ingress removal
- Target groups remain attached
- Security groups cannot be deleted

#### Solution Implementation
```bash
# Force delete ALB
ALB_ARN=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `k8s-3tierapp`)].LoadBalancerArn' --output text)
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN

# Delete target groups
aws elbv2 describe-target-groups --load-balancer-arn $ALB_ARN --query 'TargetGroups[].TargetGroupArn' --output text | xargs -I {} aws elbv2 delete-target-group --target-group-arn {}

# Delete security groups
aws ec2 describe-security-groups --filters "Name=group-name,Values=*k8s-3tierapp*" --query 'SecurityGroups[].GroupId' --output text | xargs -I {} aws ec2 delete-security-group --group-id {}
```

---

## Essential Troubleshooting Commands

### Kubernetes Diagnostics

```bash
# Cluster and Node Information
kubectl cluster-info
kubectl get nodes -o wide
kubectl describe nodes
kubectl top nodes

# Pod and Deployment Diagnostics
kubectl get pods -n routeclouds-ns -o wide
kubectl describe pod <pod-name> -n routeclouds-ns
kubectl logs -n routeclouds-ns <pod-name> --previous
kubectl logs -n routeclouds-ns -l app=backend --tail=50

# Service and Networking
kubectl get svc -n routeclouds-ns
kubectl get endpoints -n routeclouds-ns
kubectl describe svc <service-name> -n routeclouds-ns

# Ingress and Load Balancer
kubectl get ingress -n routeclouds-ns
kubectl describe ingress routeclouds-ingress -n routeclouds-ns
kubectl logs -n kube-system deployment/aws-load-balancer-controller

# Events and Troubleshooting
kubectl get events -n routeclouds-ns --sort-by='.lastTimestamp'
kubectl get events --field-selector type=Warning -n routeclouds-ns
```

### AWS Resource Diagnostics

```bash
# EKS Cluster
aws eks describe-cluster --name routeclouds-prod-cluster
aws eks list-addons --cluster-name routeclouds-prod-cluster
aws eks describe-nodegroup --cluster-name routeclouds-prod-cluster --nodegroup-name example

# RDS Database
aws rds describe-db-instances --db-instance-identifier routeclouds-prod-db
aws rds describe-db-subnet-groups --db-subnet-group-name routeclouds-prod-db-subnet-group

# VPC and Networking
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*bootcamp*"
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<vpc-id>"
aws ec2 describe-security-groups --filters "Name=group-name,Values=*bootcamp*"

# Load Balancers
aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `k8s-3tierapp`)]'
aws elbv2 describe-target-groups --load-balancer-arn <alb-arn>
```

### Database Connectivity Testing

```bash
# DNS Resolution Test
kubectl run dns-test --rm -it --image=tutum/dnsutils -n routeclouds-ns -- dig postgres-db.routeclouds-ns.svc.cluster.local

# Database Connection Test
kubectl run db-test --rm -it --image=postgres:13 -n routeclouds-ns -- bash
# Inside pod: PGPASSWORD=<password> psql -h postgres-db.routeclouds-ns.svc.cluster.local -U postgres -d postgres

# Automated Credential Sync
./k8s/update-db-secrets.sh
```

---

## Automated Diagnostic Scripts

### Node Group Troubleshooting Script

**File**: `eks-nodegroup-troubleshoot.sh`

```bash
#!/bin/bash
# EKS Node Group Troubleshooting Script

CLUSTER_NAME="routeclouds-prod-cluster"
NODEGROUP_NAME="example"

echo "=== EKS Node Group Diagnostics ==="
echo "Cluster: $CLUSTER_NAME"
echo "Node Group: $NODEGROUP_NAME"
echo ""

# Check cluster status
echo "1. Cluster Status:"
aws eks describe-cluster --name $CLUSTER_NAME --query 'cluster.status'

# Check node group status
echo "2. Node Group Status:"
aws eks describe-nodegroup --cluster-name $CLUSTER_NAME --nodegroup-name $NODEGROUP_NAME --query 'nodegroup.status'

# Check add-ons
echo "3. EKS Add-ons:"
aws eks list-addons --cluster-name $CLUSTER_NAME

# Check nodes in kubectl
echo "4. Kubernetes Nodes:"
kubectl get nodes -o wide

# Check system pods
echo "5. System Pods Status:"
kubectl get pods -n kube-system

# Check Auto Scaling Group
echo "6. Auto Scaling Group:"
ASG_NAME=$(aws eks describe-nodegroup --cluster-name $CLUSTER_NAME --nodegroup-name $NODEGROUP_NAME --query 'nodegroup.resources.autoScalingGroups[0].name' --output text)
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG_NAME --query 'AutoScalingGroups[0].{DesiredCapacity:DesiredCapacity,MinSize:MinSize,MaxSize:MaxSize,Instances:Instances[].InstanceId}'

echo "=== Diagnostics Complete ==="
```

### Database Connectivity Validation Script

```bash
#!/bin/bash
# Database Connectivity Validation Script

NAMESPACE="routeclouds-ns"

echo "=== Database Connectivity Validation ==="

# Check if namespace exists
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    echo "❌ Namespace $NAMESPACE does not exist"
    exit 1
fi

# Check database service
echo "1. Database Service Status:"
kubectl get svc postgres-db -n $NAMESPACE

# Check database secret
echo "2. Database Secret Status:"
kubectl get secret db-secrets -n $NAMESPACE

# Test DNS resolution
echo "3. DNS Resolution Test:"
kubectl run dns-test --rm -it --restart=Never --image=tutum/dnsutils -n $NAMESPACE -- dig postgres-db.$NAMESPACE.svc.cluster.local

# Test database connectivity
echo "4. Database Connectivity Test:"
DB_PASSWORD=$(kubectl get secret db-secrets -n $NAMESPACE -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)
kubectl run db-connectivity-test --rm -it --restart=Never --image=postgres:13 -n $NAMESPACE -- bash -c "PGPASSWORD='$DB_PASSWORD' psql -h postgres-db.$NAMESPACE.svc.cluster.local -U postgres -d postgres -c 'SELECT version();'"

echo "=== Validation Complete ==="
```

---

## Troubleshooting Decision Trees

### Pod Startup Issues Decision Tree

```
Pod Not Starting
├── Check Pod Status
│   ├── Pending → Resource/Scheduling Issues
│   │   ├── Check Node Resources → Scale nodes if needed
│   │   ├── Check Resource Requests → Reduce if too high
│   │   └── Check Node Selectors → Verify node labels
│   ├── ImagePullBackOff → Image Issues
│   │   ├── Check Image Exists → Verify ECR repository
│   │   ├── Check Image Tag → Update deployment
│   │   └── Check ECR Permissions → Update IAM policies
│   ├── CrashLoopBackOff → Application Issues
│   │   ├── Check Application Logs → Fix application errors
│   │   ├── Check Environment Variables → Update secrets/configmaps
│   │   └── Check Health Checks → Adjust probe settings
│   └── CreateContainerConfigError → Configuration Issues
│       ├── Check Secrets → Verify secret exists and format
│       ├── Check ConfigMaps → Verify configmap exists
│       └── Check Volume Mounts → Fix mount paths
```

### Database Connectivity Decision Tree

```
Database Connection Failed
├── Check DNS Resolution
│   ├── Success → Check Authentication
│   └── Failure → Check Service Configuration
│       ├── Verify ExternalName Service → Update RDS endpoint
│       ├── Check Service Namespace → Ensure correct namespace
│       └── Check DNS Policies → Verify CoreDNS configuration
├── Check Authentication
│   ├── Password Mismatch → Sync Credentials
│   │   ├── Run update-db-secrets.sh → Automated sync
│   │   └── Manual Credential Update → Update Kubernetes secret
│   ├── User Not Found → Check Database Users
│   └── Permission Denied → Check Database Permissions
├── Check Network Connectivity
│   ├── Security Group Rules → Update RDS security group
│   ├── Network ACLs → Check subnet ACLs
│   └── Route Tables → Verify routing to RDS subnets
```

### ALB Creation Decision Tree

```
ALB Not Creating
├── Check Subnet Tags
│   ├── Missing Tags → Tag Subnets
│   │   ├── Public Subnets → kubernetes.io/role/elb=1
│   │   └── Private Subnets → kubernetes.io/role/internal-elb=1
│   └── Incorrect Tags → Fix Tag Values
├── Check ALB Controller
│   ├── Controller Not Running → Install/Restart Controller
│   ├── Permission Issues → Check IAM Role
│   └── Webhook Issues → Check ValidatingWebhookConfiguration
├── Check Ingress Configuration
│   ├── Missing Annotations → Add Required Annotations
│   ├── Invalid IngressClass → Create/Fix IngressClass
│   └── Service Not Found → Check Service Exists
```

---

## Prevention Strategies

### Infrastructure Best Practices

1. **Always use Terraform state locking** with S3 backend and DynamoDB
2. **Implement proper tagging strategy** for all AWS resources
3. **Use consistent naming conventions** across all resources
4. **Enable CloudTrail logging** for audit trails
5. **Set up monitoring and alerting** for critical resources

### Application Deployment Best Practices

1. **Use health checks** for all application pods
2. **Implement proper resource limits** and requests
3. **Use rolling updates** for zero-downtime deployments
4. **Maintain separate environments** (dev/staging/prod)
5. **Implement proper secret management** with external secrets

### Operational Best Practices

1. **Regular backup testing** for RDS and application data
2. **Disaster recovery procedures** documented and tested
3. **Monitoring and alerting** for all critical components
4. **Regular security updates** for all components
5. **Documentation maintenance** for all procedures

---

## Emergency Response Procedures

### Complete System Failure

1. **Assess Impact**: Determine scope of failure
2. **Isolate Issue**: Prevent further damage
3. **Restore Service**: Use backup/DR procedures
4. **Root Cause Analysis**: Identify and fix underlying cause
5. **Post-Incident Review**: Update procedures and documentation

### Data Loss Prevention

1. **Immediate Backup**: Create emergency backup if possible
2. **Stop Write Operations**: Prevent further data corruption
3. **Assess Damage**: Determine extent of data loss
4. **Restore from Backup**: Use most recent clean backup
5. **Validate Restoration**: Ensure data integrity

This comprehensive troubleshooting guide provides systematic approaches to identify, diagnose, and resolve common issues in the 3-tier EKS application deployment. Use the decision trees and diagnostic commands to quickly narrow down problems and implement appropriate solutions.
