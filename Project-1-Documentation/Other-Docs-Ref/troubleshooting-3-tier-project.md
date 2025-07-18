# Troubleshooting: 3-Tier Project Terraform EKS Module Error

## Issue Summary

When running `terraform plan` in the infra directory, you may encounter errors like:

```
Error: Unsupported block type

  on .terraform/modules/eks/modules/eks-managed-node-group/main.tf line 140, in resource "aws_launch_template" "this":
  140:   dynamic "elastic_gpu_specifications" {

Blocks of type "elastic_gpu_specifications" are not expected here.
```

And similar errors for `elastic_inference_accelerator` blocks.

## Root Cause

These errors occur because the version of the `terraform-aws-modules/eks/aws` module specified in `eks.tf` is not fully compatible with the AWS provider version or Terraform version in use. The module version may include resource blocks that are not supported by the current AWS provider, leading to 'Unsupported block type' errors during plan or apply.

## Solution

**Update the EKS module version in `eks.tf` to a compatible version.**

- The recommended fix is to use a version constraint that matches the latest stable 20.x release, which is compatible with the AWS provider and Terraform versions in use.
- Change the version line in `eks.tf` from:

  ```hcl
  version = "20.33.1"
  ```
  to:
  ```hcl
  version = "~> 20.31"
  ```

This ensures you get a compatible 20.x version that includes all necessary fixes and avoids the unsupported block errors.

## What Was Fixed

- File: `infra/eks.tf`
- Change:
  - **Before:**
    ```hcl
    version = "20.33.1"
    ```
  - **After:**
    ```hcl
    version = "~> 20.31"
    ```

## Additional Steps

1. After making this change, run:
   ```bash
   terraform init -upgrade
   terraform plan
   ```
2. This will reinitialize the module to the correct version and resolve the errors.

## References
- [terraform-aws-modules/eks/aws - Official Documentation](https://github.com/terraform-aws-modules/terraform-aws-eks)
- [Upgrade Guide for v20.x](https://github.com/terraform-aws-modules/terraform-aws-eks/blob/master/docs/UPGRADE-20.0.md)

---
If you encounter further issues, ensure your AWS provider is also up to date and compatible with the module version. 

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.95.0, < 6.0.0"
    }
    # Add other providers as needed
  }
} 

# Troubleshooting: EKS Node Group Creation Failure

## Issue Summary

When running `terraform apply` for the EKS infrastructure, you may encounter errors such as:

```
Error: waiting for EKS Node Group (...:example-...) create: unexpected state 'CREATE_FAILED', wanted target 'ACTIVE'. last error: ... NodeCreationFailure: Unhealthy nodes in the kubernetes cluster
```

This indicates that the EKS node group failed to create because the EC2 instances (nodes) could not become healthy in the cluster.

## Possible Causes

1. **Subnet/VPC Misconfiguration**
   - Subnets are not private/public as required or not tagged correctly.
   - No route to NAT Gateway/Internet Gateway for outbound access.
   - Wrong subnet IDs provided to the EKS module.
2. **IAM Role Issues**
   - Node group role missing required policies or incorrect trust relationship.
3. **EC2 Capacity/Quota**
   - No available capacity for the requested instance type in the selected AZs.
   - Hitting EC2 service quotas.
4. **Security Group Issues**
   - Security groups do not allow required traffic (to control plane, between nodes).
5. **AMI/Bootstrap Failure**
   - Wrong AMI type or region not supported.
   - Bootstrap script fails (user data, add-ons, etc.).
6. **EKS Add-ons/Version Mismatch**
   - Add-ons (like VPC CNI) not installed or misconfigured.
   - Cluster version and node AMI version mismatch.

## Step-by-Step Troubleshooting & Debugging

### 1. Check Node Group Status in AWS Console
- Go to EKS → Clusters → Your Cluster → Compute → Node Groups.
- Look for error messages and events.

### 2. Check CloudFormation Stack Events
- EKS node groups are created via CloudFormation.
- Go to CloudFormation → Stacks → Find the stack for your node group (name will include your cluster and node group name).
- Check the "Events" tab for failure reasons.

### 3. Check EC2 Instances
- Go to EC2 → Instances.
- Look for instances with the node group name.
- Check their status (running, stopped, terminated).
- Select an instance → Actions → Monitor and troubleshoot → Get system log.

### 4. Check Subnet and VPC Configuration
- Ensure subnets are private (no direct route to IGW, but have route to NAT GW).
- Ensure subnets are tagged for EKS:
  - `kubernetes.io/cluster/<cluster-name> = shared`
  - `kubernetes.io/role/internal-elb = 1` (for private)
  - `kubernetes.io/role/elb = 1` (for public)
- **Commands:**
  ```sh
  aws ec2 describe-subnets --filters "Name=tag:kubernetes.io/cluster/<cluster-name>,Values=shared"
  aws ec2 describe-route-tables --filters "Name=association.subnet-id,Values=<subnet-id>"
  ```

### 5. Check IAM Role and Policies
- Go to IAM → Roles → Find the node group role.
- Ensure it has:
  - `AmazonEKSWorkerNodePolicy`
  - `AmazonEKS_CNI_Policy`
  - `AmazonEC2ContainerRegistryReadOnly`
- **Command:**
  ```sh
  aws iam list-attached-role-policies --role-name <node-group-role>
  ```

### 6. Check Security Groups
- Node group security group must allow:
  - All traffic to/from the cluster security group (port 443, 1025-65535 TCP/UDP).
- **Command:**
  ```sh
  aws ec2 describe-security-groups --group-ids <sg-id>
  ```

### 7. Check EC2 Capacity and Quotas
- Check for available capacity in your region/AZ for the instance type.
- **Command:**
  ```sh
  aws ec2 describe-instance-type-offerings --location-type availability-zone --filters Name=instance-type,Values=t3.medium
  aws service-quotas get-service-quota --service-code ec2 --quota-code L-1216C47A
  ```

### 8. Check AMI and Bootstrap
- Ensure the AMI type is supported for your EKS version and region.
- Check EC2 instance logs for bootstrap errors.

### 9. Check EKS Add-ons
- Go to EKS → Add-ons.
- Ensure VPC CNI, CoreDNS, kube-proxy are installed and healthy.

## Terraform Code Review for Common Issues

- Using `terraform-aws-modules/eks/aws` (ensure version is compatible with AWS provider).
- `subnet_ids` should be private subnets with NAT access.
- `ami_type` should match EKS version and region support.
- `instance_types` should be available in your region/AZ.
- `enable_cluster_creator_admin_permissions` is recommended for initial setup.
- `cluster_endpoint_public_access` can be true for initial setup.

**Potential Issues to Check:**
- Are your subnets truly private and have NAT Gateway access?
- Are the subnets tagged as required by EKS?
- Is the IAM role for the node group created and attached with the right policies?
- Are your security groups open as required?
- Is there EC2 capacity for your instance type in your region/AZ?

## Debugging Example: EC2 Instance Logs
- Go to EC2 → Instances → Select a failed node.
- Actions → Monitor and troubleshoot → Get system log.
- Look for errors related to kubelet, bootstrap, or networking.

## Summary Table

| Check           | Command/Action                                                                 | What to Look For                                 |
|-----------------|-------------------------------------------------------------------------------|--------------------------------------------------|
| Subnets         | `aws ec2 describe-subnets`                                                    | Correct tags, private, NAT access                |
| Route Tables    | `aws ec2 describe-route-tables`                                               | Route to NAT GW for private subnets              |
| IAM Role        | `aws iam list-attached-role-policies`                                         | Required policies attached                       |
| Security Groups | `aws ec2 describe-security-groups`                                            | Allow traffic to/from control plane              |
| EC2 Capacity    | `aws ec2 describe-instance-type-offerings`                                    | t3.medium available in AZ                        |
| CloudFormation  | AWS Console                                                                   | Stack events for errors                          |
| EC2 Logs        | AWS Console                                                                   | Bootstrap or kubelet errors                      |
| EKS Add-ons     | AWS Console                                                                   | All add-ons healthy                              |

---

## Solution

The primary reason for the `NodeCreationFailure` error is often a misconfiguration in the VPC subnets, preventing the EKS worker nodes from communicating with the control plane. The most common issue is missing the required tags on the subnets that EKS uses for auto-discovery.

To resolve this, you need to add the following tags to your public and private subnets in `infra/network.tf`:

-   `kubernetes.io/cluster/<cluster-name>`: This tag is essential for the EKS control plane to identify which subnets it can use for deploying resources like load balancers and for worker nodes to discover the cluster.
-   `kubernetes.io/role/elb`: This tag is used by the AWS Load Balancer Controller to identify public subnets for creating public-facing load balancers.
-   `kubernetes.io/role/internal-elb`: This tag is used to identify private subnets for creating internal load balancers.

Here is how you can modify your `infra/network.tf` to include these tags:

```hcl
module "eks_network" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"

  name = "${var.prefix}-${var.environment}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-south-1a", "ap-south-1b"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24", "10.0.4.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = {
    "kubernetes.io/cluster/${var.prefix}-${var.environment}-cluster" = "shared"
    "kubernetes.io/role/elb"                                        = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${var.prefix}-${var.environment}-cluster" = "shared"
    "kubernetes.io/role/internal-elb"                               = "1"
  }
}
```

After applying this change, your EKS nodes should be able to join the cluster successfully.

### Why This Solution Works

EKS requires specific subnet tags for auto-discovery and resource placement. The tag `kubernetes.io/cluster/<cluster-name>` allows the EKS control plane to identify which subnets it can use for node placement and load balancer creation. The tags `kubernetes.io/role/elb` and `kubernetes.io/role/internal-elb` distinguish public and private subnets for external and internal load balancers, respectively. Without these tags, EKS cannot properly place worker nodes or provision load balancers, resulting in NodeCreationFailure errors. This solution aligns with AWS and Terraform best practices and is necessary for a functional EKS cluster.

**Tip:** Run these checks and commands when you encounter node group creation failures. If you find a specific error in EC2 logs or CloudFormation, investigate further or seek targeted help. 