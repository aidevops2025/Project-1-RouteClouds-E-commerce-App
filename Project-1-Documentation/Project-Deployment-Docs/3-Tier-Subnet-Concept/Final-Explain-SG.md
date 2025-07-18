# Security Group Architecture Analysis for 3-Tier EKS Application

This document provides a comprehensive analysis of the security group architecture used in the 3-tier application deployed on AWS EKS. The analysis is based on the security group data collected from the AWS environment.

## Overview

The security group architecture follows a layered approach to secure different components of the 3-tier application running on EKS. The architecture consists of several security groups with specific purposes, controlling traffic between different tiers of the application and external resources.

## Key Security Groups

### 1. EKS Cluster Security Group (`sg-07dac932c272e2161`)

**Name**: bootcamp-dev-cluster-cluster-20250707054149030200000009  
**Description**: EKS cluster security group  
**Purpose**: Controls access to the Kubernetes API server (control plane)

**Key Rules**:
- **Inbound**: 
  - TCP 443 from node security group (`sg-03f55598554824f73`) - Allows nodes to communicate with the Kubernetes API server

**References**:
- Referenced by node security group (`sg-03f55598554824f73`)
- Referenced by RDS security group (`sg-028044234144db4c1`)

### 2. EKS Node Security Group (`sg-03f55598554824f73`)

**Name**: bootcamp-dev-cluster-node-2025070705415142120000000a  
**Description**: EKS node shared security group  
**Purpose**: Controls communication between worker nodes and allows pods to communicate

**Key Rules**:
- **Inbound**:
  - **Rule sgr-0b08d02da1b2ff9bf**: TCP 80-8000 from load balancer security group (`sg-04cce232dcd1fb94e`) - This rule is tagged with "elbv2.k8s.aws/targetGroupBinding=shared", which means it's created by the AWS Load Balancer Controller to allow traffic from the shared load balancer to the application pods running on the nodes. The wide port range (80-8000) allows flexibility for different applications to use different ports.
  
  - **Rule sgr-0455838591020b9c3**: UDP 53 from itself - This rule allows "Node to node CoreDNS UDP" traffic. CoreDNS is the DNS service running in Kubernetes that handles service discovery. This self-referencing rule allows DNS resolution between pods on different nodes using UDP protocol on port 53.
  
  - **Rule sgr-0b0301c546a25389e**: TCP 1025-65535 from itself - This rule allows "Node to node ingress on ephemeral ports". Ephemeral ports (high-numbered ports) are used for temporary connections between pods on different nodes. This self-referencing rule is essential for pod-to-pod communication across nodes, especially for services that dynamically allocate ports.
  
  - TCP 6443, 8443, 9443, 10250, 443, 4443 from cluster security group - Allows control plane to node communication for various Kubernetes components:
    - 10250: Kubelet API
    - 443: HTTPS API server communication
    - 4443/9443: Webhook admission controllers
    - 6443/8443: Additional API endpoints

- **Outbound**:
  - ALL traffic to any destination (0.0.0.0/0) - Allows nodes to reach external resources

**References**:
- References cluster security group (`sg-07dac932c272e2161`) for API server access
- Referenced by cluster security group for kubelet communication

### 3. RDS Security Group (`sg-028044234144db4c1`)

**Name**: dev-rds-sg  
**Description**: allow inbound access from the ECS only  
**Purpose**: Controls access to the PostgreSQL database

**Key Rules**:
- **Inbound**:
  - **Rule sgr-01f83a094f4d1cb5b**: TCP 5432 (PostgreSQL) from 0.0.0.0/0 - This rule allows any IP address on the internet to connect to the PostgreSQL database on port 5432. This is a significant security concern as it exposes the database to potential unauthorized access from anywhere on the internet.
  
  - TCP 5432 (PostgreSQL) from cluster security group (`sg-07dac932c272e2161`) - This rule allows pods running in the EKS cluster to connect to the database, which is the intended and secure access pattern.

- **Outbound**:
  - ALL traffic to any destination (0.0.0.0/0) - Allows database to reach external resources if needed

**Security Implications of Rule sgr-01f83a094f4d1cb5b**:

The rule `sgr-01f83a094f4d1cb5b` in the RDS security group (`sg-028044234144db4c1`) that allows PostgreSQL access from 0.0.0.0/0 presents a serious security vulnerability:

1. **Public Exposure**: This rule makes the PostgreSQL database publicly accessible to anyone on the internet who knows the database endpoint and has valid credentials.

2. **Contradiction with Description**: The security group description states "allow inbound access from the ECS only", but this rule contradicts that intention by allowing access from anywhere.

3. **Attack Surface**: This significantly increases the attack surface for the database, making it vulnerable to:
   - Brute force attacks on the PostgreSQL port
   - Exploitation of any PostgreSQL vulnerabilities
   - Credential stuffing attacks

4. **Compliance Issues**: This configuration likely violates security best practices and may not comply with various security standards and regulations (e.g., PCI DSS, HIPAA, etc.) that require limiting database access to authorized sources only.

5. **Unnecessary Risk**: Since there's already a rule allowing access from the cluster security group, which is the legitimate source of database connections, this public access rule is unnecessary and introduces risk without providing additional functionality.

**Recommended Remediation**:

This rule should be removed immediately and replaced with more restrictive access controls:

1. **Remove Public Access**: Delete the rule allowing access from 0.0.0.0/0.

2. **Use Security Group References**: Maintain only the rule that references the cluster security group, which allows pods in the EKS cluster to access the database.

3. **Consider a Bastion Host**: If administrative access is needed, set up a bastion host in a private subnet with a specific security group, and allow database access only from that security group.

4. **Implement Database Authentication**: Ensure strong authentication mechanisms are in place, such as IAM authentication for RDS or strong password policies.

5. **Enable Enhanced Monitoring**: Enable RDS enhanced monitoring and database audit logging to detect any suspicious access attempts.

6. **Regular Security Audits**: Implement regular security audits of security group rules to catch similar issues in the future.

### 4. Load Balancer Security Groups

#### 4.1 Shared Load Balancer Security Group (`sg-04cce232dcd1fb94e`)

**Name**: k8s-traffic-bootcampdevcluster-fb83cad852  
**Description**: [k8s] Shared Backend SecurityGroup for LoadBalancer  
**Purpose**: Controls traffic to and from the Kubernetes-managed shared load balancers

**Key Rules**:
- **Inbound**: No specific inbound rules defined in this security group. Inbound rules are typically defined in the frontend security groups that are created for specific ingress resources.
- **Outbound**:
  - ALL traffic to any destination (0.0.0.0/0) - Allows load balancer to reach any destination, particularly the node security group for routing traffic to pods

**References**:
- Referenced by node security group (`sg-03f55598554824f73`) for inbound traffic

#### 4.2 Application-Specific Load Balancer Security Group (`sg-04fb7bcc9a38ec5bd`)

**Name**: k8s-3tierapp-3tierapp-0d8d19d336  
**Description**: [k8s] Managed SecurityGroup for LoadBalancer  
**Purpose**: Controls traffic for the application-specific load balancer

**Why Two Load Balancer Security Groups?**
The architecture uses two different load balancer security groups for different purposes:

1. **Shared Load Balancer Security Group (`sg-04cce232dcd1fb94e`)**: 
   - Created by the AWS Load Balancer Controller as a shared backend security group
   - Used for multiple services/ingresses that can share the same load balancer
   - Provides a common set of rules for all load balancers managed by the controller

2. **Application-Specific Load Balancer Security Group (`sg-04fb7bcc9a38ec5bd`)**:
   - Created specifically for the 3-tier application
   - Contains rules tailored to the specific application's needs
   - Allows for more granular control over the specific application's traffic

This dual approach allows for both shared infrastructure (reducing costs and management overhead) and application-specific customization when needed.

### 5. EKS Control Plane Security Group (`sg-0a2172ac09fcb8b08`)

**Name**: eks-cluster-sg-bootcamp-dev-cluster-536903144  
**Description**: EKS created security group applied to ENI that is attached to EKS Control Plane master nodes, as well as any managed workloads  
**Purpose**: Controls traffic to and from the EKS control plane

**Key Rules**:
- **Inbound**:
  - ALL protocols from itself - Allows EFA (Elastic Fabric Adapter) traffic within the control plane
- **Outbound**:
  - ALL traffic to any destination (0.0.0.0/0) - Allows control plane to reach any destination

## Security Group Relationships

The security groups form a layered architecture that controls traffic flow between different components:

1. **External Traffic Flow**:
   - Internet → Load Balancer SG → Node SG → Application Pods

2. **Database Access Flow**:
   - Application Pods → Node SG → Cluster SG → RDS SG → RDS Instance

3. **Kubernetes Control Flow**:
   - Node SG → Cluster SG → EKS Control Plane
   - EKS Control Plane → Control Plane SG → Node SG → Kubelet

4. **Inter-Node Communication Flow**:
   - Node → Node SG (self-referencing rules) → Node
   - This includes:
     - CoreDNS traffic on UDP port 53 for DNS resolution
     - Traffic on ephemeral ports (1025-65535) for dynamic pod-to-pod communication

## Understanding Self-Referencing Rules in Node Security Group

The node security group (`sg-03f55598554824f73`) contains several self-referencing rules that are critical for Kubernetes functionality:

1. **CoreDNS Communication (UDP port 53)**:
   - Rule ID: sgr-0455838591020b9c3
   - Purpose: Allows DNS resolution between pods on different nodes
   - Without this rule, service discovery would fail, and pods wouldn't be able to find each other by service names

2. **Ephemeral Port Communication (TCP ports 1025-65535)**:
   - Rule ID: sgr-0b0301c546a25389e
   - Purpose: Allows dynamic pod-to-pod communication across nodes
   - Kubernetes uses ephemeral (high-numbered) ports for many internal communications
   - This rule is essential for services that dynamically allocate ports for communication

3. **CoreDNS TCP Communication (TCP port 53)**:
   - Purpose: Allows DNS resolution using TCP protocol (for larger DNS responses)
   - Complements the UDP rule for complete DNS functionality

These self-referencing rules are standard in EKS deployments and are necessary for proper cluster operation. They allow pods on different nodes to communicate with each other directly, which is a fundamental requirement for Kubernetes networking.

## Understanding Load Balancer Controller Rules

The rule `sgr-0b08d02da1b2ff9bf` in the node security group with the tag "elbv2.k8s.aws/targetGroupBinding=shared" is created by the AWS Load Balancer Controller. This controller manages AWS Elastic Load Balancers for Kubernetes services.

- **Purpose**: Allows traffic from the load balancer to reach the target pods on the nodes
- **Port Range (80-8000)**: Provides flexibility for different applications to use different ports
- **Tag Meaning**: The "shared" value indicates this rule is used by multiple services/ingresses

The AWS Load Balancer Controller automatically creates and manages these security group rules based on Kubernetes Service and Ingress resources, simplifying the management of load balancer configurations.

## Security Concerns and Recommendations

### 1. Public Database Access (Critical)

The RDS security group (`sg-028044234144db4c1`) contains rule `sgr-01f83a094f4d1cb5b` that allows inbound access on port 5432 from 0.0.0.0/0, which means the database is accessible from the internet. This is a critical security vulnerability.

**Recommendation**: 
- Immediately remove the 0.0.0.0/0 CIDR rule
- Only allow access from the cluster security group or a bastion host
- Implement additional security measures such as database encryption, strong authentication, and audit logging

### 2. Overly Permissive Outbound Rules

Most security groups have outbound rules allowing all traffic to any destination (0.0.0.0/0). While this is common practice, it could be restricted to only necessary destinations for improved security.

**Recommendation**: Limit outbound rules to only required destinations and ports.

### 3. Wide Port Ranges in Node Security Group

The node security group allows traffic on a wide range of ports (80-8000 for load balancer traffic, 1025-65535 for ephemeral ports). While necessary for functionality, these wide ranges could potentially be narrowed.

**Recommendation**: Regularly audit which ports are actually being used and consider narrowing the ranges if possible.

## Best Practices Implementation

### 1. Security Group References

The architecture correctly uses security group references instead of CIDR blocks in many cases, which is a best practice. This ensures that if IP addresses change, the security rules remain valid.

### 2. Layered Security

The architecture implements a layered security approach, with different security groups for different components, which is a best practice.

### 3. Principle of Least Privilege

While there are some overly permissive rules, the architecture generally follows the principle of least privilege by restricting inbound access to specific ports and sources.

### 4. Automation with AWS Load Balancer Controller

The use of the AWS Load Balancer Controller to automatically manage security group rules for load balancers is a best practice, as it reduces manual configuration and potential errors.

## Visualization of Security Group Relationships

```
Internet ↔ Load Balancer SGs (sg-04cce232dcd1fb94e, sg-04fb7bcc9a38ec5bd) ↔ Node SG (sg-03f55598554824f73) ↔ Cluster SG (sg-07dac932c272e2161) ↔ RDS SG (sg-028044234144db4c1)
                                                                      ↑
                                                                      ↓
                                                      Control Plane SG (sg-0a2172ac09fcb8b08)
```

## Conclusion

The security group architecture for the 3-tier EKS application follows many best practices, including the use of security group references, layered security, and specific rules for different components. The architecture makes good use of self-referencing rules for inter-node communication and leverages the AWS Load Balancer Controller for automated management of load balancer security groups.

However, there are some security concerns, particularly with the public database access (rule `sgr-01f83a094f4d1cb5b`) and overly permissive outbound rules, which should be addressed to improve the overall security posture.

By implementing the recommendations provided in this analysis, the security of the 3-tier application can be further enhanced while maintaining the required functionality.
