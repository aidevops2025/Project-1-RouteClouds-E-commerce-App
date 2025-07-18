# AWS Infrastructure Migration Guide: ap-south-1 → us-east-1

## Overview
This document outlines the complete migration process for the 3-tier EKS application infrastructure from the Asia Pacific (Mumbai) region (ap-south-1) to the US East (N. Virginia) region (us-east-1).

## Migration Summary

### Current State
- **Source Region**: ap-south-1 (Asia Pacific - Mumbai)
- **Target Region**: us-east-1 (US East - N. Virginia)
- **Infrastructure**: EKS Cluster, RDS PostgreSQL, VPC, Security Groups, KMS, Secrets Manager

### Benefits of Migration to us-east-1
1. **Cost Optimization**: us-east-1 typically offers lower pricing for most AWS services
2. **Service Availability**: Widest range of AWS services and features
3. **Performance**: Lower latency for users in North America
4. **Compliance**: Some services and features are available first in us-east-1

## Detailed Analysis

### Components Requiring Changes

#### 1. Region Configuration
- **Files Affected**: `terraform.tfvars`, `variables.tf`, `providers.tf`
- **Change Type**: Region parameter updates
- **Impact**: Primary configuration change

#### 2. Availability Zones
- **Files Affected**: `network.tf`, `rds.tf`
- **Current AZs**: ap-south-1a, ap-south-1b
- **Target AZs**: us-east-1a, us-east-1b
- **Impact**: Subnet and RDS placement

#### 3. Provider Configuration
- **File**: `providers.tf`
- **Issue**: Missing region specification in provider block
- **Solution**: Add explicit region configuration

### Components NOT Requiring Changes

#### 1. AMI Configuration ✅
- **EKS Node Groups**: Using `AL2023_x86_64_STANDARD` (managed AMI type)
- **Reason**: AWS automatically provides region-appropriate AMIs for managed types
- **No Action Required**: AMI IDs are automatically resolved by AWS

#### 2. Instance Types ✅
- **Current Types**: t3.medium, t3.micro, db.t3.micro
- **Availability**: All instance types available in us-east-1
- **No Action Required**: Instance types are region-agnostic

#### 3. Network Configuration ✅
- **VPC CIDR**: 10.0.0.0/16 (region-independent)
- **Subnet CIDRs**: All subnet configurations remain valid
- **Security Groups**: No region-specific rules

#### 4. Application Configuration ✅
- **EKS Version**: 1.31 (available in us-east-1)
- **RDS Engine**: PostgreSQL 14.15 (available in us-east-1)
- **Add-ons**: All EKS add-ons supported in us-east-1

## Required File Modifications

### File 1: terraform.tfvars
```hcl
# BEFORE
aws_region   = "ap-south-1"

# AFTER
aws_region   = "us-east-1"
```

### File 2: variables.tf
```hcl
# BEFORE
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

# AFTER
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}
```

### File 3: providers.tf
```hcl
# BEFORE
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.95.0, < 6.0.0"
    }
  }
}

# AFTER
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
```

### File 4: network.tf
```hcl
# BEFORE
azs = ["ap-south-1a", "ap-south-1b"]

# AFTER
azs = ["us-east-1a", "us-east-1b"]
```

### File 5: rds.tf
```hcl
# BEFORE
resource "aws_subnet" "rds_1" {
  cidr_block        = "10.0.5.0/24"
  availability_zone = "ap-south-1a"
  vpc_id            = module.eks_network.vpc_id
  # ...
}

resource "aws_subnet" "rds_2" {
  cidr_block        = "10.0.6.0/24"
  availability_zone = "ap-south-1b"
  vpc_id            = module.eks_network.vpc_id
  # ...
}

# AFTER
resource "aws_subnet" "rds_1" {
  cidr_block        = "10.0.5.0/24"
  availability_zone = "us-east-1a"
  vpc_id            = module.eks_network.vpc_id
  # ...
}

resource "aws_subnet" "rds_2" {
  cidr_block        = "10.0.6.0/24"
  availability_zone = "us-east-1b"
  vpc_id            = module.eks_network.vpc_id
  # ...
}
```

## Migration Process

### Pre-Migration Steps
1. **Backup Current State**
   - Export current Terraform state
   - Document all resource IDs and configurations
   - Backup application data if needed

2. **Validate Target Region**
   - Confirm all required services are available in us-east-1
   - Check service quotas and limits
   - Verify compliance requirements

### Migration Execution
1. **Update Configuration Files** (as detailed above)
2. **Initialize New State** (recommended approach)
   - Start with fresh Terraform state in new region
   - Avoid state migration complexities
3. **Deploy Infrastructure**
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

### Post-Migration Steps
1. **Verify Infrastructure**
   - Test EKS cluster connectivity
   - Validate RDS connectivity
   - Check security group rules
2. **Update Application Configuration**
   - Update kubeconfig for new cluster
   - Update database connection strings
   - Update any hardcoded region references
3. **DNS and Load Balancer Updates**
   - Update Route53 records if applicable
   - Update load balancer configurations

## Cost Implications

### Expected Cost Changes
- **Compute**: ~10-15% reduction in EC2 costs
- **Storage**: ~5-10% reduction in EBS costs
- **Data Transfer**: Potential changes based on traffic patterns
- **RDS**: ~10-15% reduction in database costs

### Cost Optimization Opportunities
- Consider Reserved Instances in us-east-1
- Evaluate Savings Plans for compute workloads
- Review storage classes for cost optimization

## Risk Assessment

### Low Risk ✅
- AMI compatibility (using managed AMI types)
- Instance type availability
- Service feature parity

### Medium Risk ⚠️
- Application downtime during migration
- DNS propagation delays
- Data migration complexity

### Mitigation Strategies
- Plan migration during maintenance window
- Use blue-green deployment strategy
- Test thoroughly in staging environment

## Rollback Plan

### If Migration Fails
1. **Keep Original Infrastructure**: Don't destroy ap-south-1 resources until migration is confirmed successful
2. **DNS Rollback**: Revert DNS changes to point back to ap-south-1
3. **Application Rollback**: Restore application configuration to use ap-south-1 resources

### Recovery Time Objective (RTO)
- **Target RTO**: 30 minutes
- **Maximum RTO**: 2 hours

## Validation Checklist

### Infrastructure Validation
- [ ] EKS cluster is running and accessible
- [ ] Worker nodes are healthy and joined to cluster
- [ ] RDS instance is running and accessible
- [ ] Security groups allow required traffic
- [ ] KMS keys are created and accessible
- [ ] Secrets Manager secrets are created

### Application Validation
- [ ] Applications can connect to database
- [ ] Load balancers are functioning
- [ ] Monitoring and logging are working
- [ ] Backup processes are configured

## Timeline

### Estimated Migration Time
- **Preparation**: 2-4 hours
- **Infrastructure Deployment**: 30-45 minutes
- **Application Deployment**: 15-30 minutes
- **Validation**: 30-60 minutes
- **Total**: 3-6 hours

## Support and Troubleshooting

### Common Issues
1. **Availability Zone Errors**: Ensure AZs exist in target region
2. **Instance Type Unavailability**: Verify instance types in target AZs
3. **Service Quotas**: Check and request quota increases if needed

### Emergency Contacts
- AWS Support (if applicable)
- DevOps team lead
- Application team contacts

---

**Document Version**: 1.0  
**Created**: 2025-07-04  
**Last Updated**: 2025-07-04  
**Author**: DevOps Team
