# Security Group Architecture for 3-Tier EKS Application

This document explains the security group architecture used in our 3-tier application deployed on AWS EKS, including how they interact with each other and what traffic flows they permit.

## Overview of Security Groups in EKS

Security groups in AWS act as virtual firewalls that control inbound and outbound traffic at the instance level. In an EKS deployment, multiple security groups work together to create a secure network environment while allowing necessary communication between components.

## Key Security Groups in Our Architecture

### 1. Cluster Security Group

**Purpose**: Controls communication to and from the Kubernetes API server (control plane).

**Key Rules**:
- **Inbound**: 
  - TCP 443 (HTTPS) from node groups for API server communication
  - TCP 443 from administrator IPs for kubectl access
- **Outbound**:
  - TCP 443 and 10250 to node groups for kubelet communication
  - TCP 4443/9443 to nodes for webhook communication

**Terraform Configuration**:
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

### 2. Node Security Group

**Purpose**: Controls communication between worker nodes and allows pods to communicate.

**Key Rules**:
- **Inbound**:
  - ALL traffic from other nodes in the same security group
  - TCP 443 and 10250 from cluster security group
  - TCP ports for application services from ALB security group
- **Outbound**:
  - ALL traffic to other nodes (for pod-to-pod communication)
  - TCP 443 to cluster security group (for API server access)
  - TCP 5432 to RDS security group (for database access)
  - TCP 443 to internet (0.0.0.0/0) for pulling images and updates

**Terraform Configuration**:
```hcl
node_security_group_additional_rules = {
  ingress_self_all = {
    description = "Node to node all ports/protocols"
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    type        = "ingress"
    self        = true
  }
  egress_all = {
    description      = "Node all egress"
    protocol         = "-1"
    from_port        = 0
    to_port          = 0
    type             = "egress"
    cidr_blocks      = ["0.0.0.0/0"]
  }
}
```

### 3. RDS Security Group

**Purpose**: Controls access to the PostgreSQL database.

**Key Rules**:
- **Inbound**:
  - TCP 5432 (PostgreSQL) from node security group
- **Outbound**:
  - Minimal or no outbound rules required

**Terraform Configuration**:
```hcl
resource "aws_security_group" "rds" {
  name        = "${var.prefix}-${var.environment}-rds-sg"
  description = "Allow PostgreSQL inbound traffic from EKS"
  vpc_id      = module.eks_network.vpc_id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### 4. ALB Security Group

**Purpose**: Controls traffic to and from the Application Load Balancer.

**Key Rules**:
- **Inbound**:
  - TCP 80 and 443 from internet (0.0.0.0/0)
- **Outbound**:
  - TCP to node security group on application ports (typically 3000 for frontend, 8000 for backend)

**Terraform Configuration**:
```hcl
resource "aws_security_group" "alb" {
  name        = "${var.prefix}-${var.environment}-alb-sg"
  description = "Security group for ALB"
  vpc_id      = module.eks_network.vpc_id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

## Security Group Relationships and Traffic Flow

```
Internet ↔ ALB SG ↔ Node SG ↔ RDS SG
                     ↑
                     ↓
               Cluster SG
```

### Traffic Flow Examples:

1. **User Access to Application**:
   - Internet → ALB SG (port 80/443) → Node SG (port 3000/8000) → Application Pods

2. **Application Access to Database**:
   - Application Pods → Node SG → RDS SG (port 5432) → RDS Instance

3. **Kubernetes Control Communication**:
   - Node SG → Cluster SG (port 443) → EKS Control Plane
   - EKS Control Plane → Cluster SG → Node SG (port 10250) → Kubelet

## Analyzing Security Groups

To analyze the security groups in your deployment, you can use the following AWS CLI commands:

### 1. Get VPC ID from EKS Cluster

```bash
CLUSTER_NAME="bootcamp-dev-cluster"
REGION="us-east-1"
VPC_ID=$(aws eks describe-cluster --name $CLUSTER_NAME --region $REGION --query "cluster.resourcesVpcConfig.vpcId" --output text)
echo "VPC ID: $VPC_ID"
```

### 2. List All Security Groups in the VPC

```bash
aws ec2 describe-security-groups \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query "SecurityGroups[*].{ID:GroupId,Name:GroupName,Description:Description}" \
  --output table \
  --region $REGION
```

### 3. Examine a Specific Security Group

```bash
SG_ID="sg-0123456789abcdef"  # Replace with actual SG ID
aws ec2 describe-security-groups \
  --group-ids $SG_ID \
  --region $REGION
```

### 4. Find Security Groups Referencing Another Security Group

```bash
TARGET_SG="sg-0123456789abcdef"  # Replace with target SG ID
aws ec2 describe-security-groups \
  --filters "Name=ip-permission.group-id,Values=$TARGET_SG" \
  --query "SecurityGroups[*].{ID:GroupId,Name:GroupName}" \
  --output table \
  --region $REGION
```

## Best Practices for Security Group Management

1. **Principle of Least Privilege**: Only allow necessary traffic between components.

2. **Use Security Group References**: Instead of CIDR blocks, reference other security groups when possible.

3. **Regular Audits**: Periodically review security group rules to ensure they match current requirements.

4. **Documentation**: Keep documentation of security group purposes and relationships updated.

5. **Infrastructure as Code**: Define all security groups using Terraform or CloudFormation.

6. **Tagging**: Use consistent tagging for security groups to identify their purpose.

## Troubleshooting Security Group Issues

### Common Issues:

1. **Connection Timeouts**: Often indicates missing inbound rules.
   - Check if the source security group or CIDR is allowed on the correct port.

2. **Connection Refused**: Application is reachable but not accepting connections.
   - Verify the application is running and listening on the expected port.

3. **Intermittent Connectivity**: May indicate issues with health checks or application stability.
   - Check if health check ports are properly allowed in security groups.

### Debugging Steps:

1. **Verify Security Group Rules**: Ensure all necessary ports are open.

2. **Check Network ACLs**: Verify no restrictive NACLs are blocking traffic.

3. **Test Connectivity**: Use tools like `nc` (netcat) from within pods to test connections.

4. **Flow Logs**: Enable VPC flow logs to see accepted/rejected traffic.

## Subnet and Security Group Relationship

Security groups operate at the instance level, while subnet routing and NACLs operate at the subnet level. In our 3-tier architecture:

- **Public Subnets**: Contain ALB and NAT Gateways
  - Tagged with `kubernetes.io/role/elb=1`
  - Have route to Internet Gateway

- **Private Subnets**: Contain EKS nodes and RDS
  - Tagged with `kubernetes.io/role/internal-elb=1`
  - Route to NAT Gateway for outbound internet access

Security groups provide the fine-grained access control within these subnet boundaries.