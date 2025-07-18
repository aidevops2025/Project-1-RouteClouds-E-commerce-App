# Application Load Balancer (ALB) in 3-Tier EKS Project

This document provides a comprehensive overview of how Application Load Balancers (ALBs) are used in the 3-tier application deployment on AWS EKS, including concepts, implementation details, and best practices.

## Table of Contents

1. [Introduction to ALB](#introduction-to-alb)
2. [ALB Architecture in the 3-Tier Project](#alb-architecture-in-the-3-tier-project)
3. [Kubernetes Ingress and Ingress Controllers](#kubernetes-ingress-and-ingress-controllers)
4. [AWS Load Balancer Controller](#aws-load-balancer-controller)
5. [Ingress Resource Configuration](#ingress-resource-configuration)
6. [ALB Components and Workflow](#alb-components-and-workflow)
7. [Security Group Configuration](#security-group-configuration)
8. [Subnet Configuration and Requirements](#subnet-configuration-and-requirements)
9. [Path-Based Routing](#path-based-routing)
10. [Health Checks](#health-checks)
11. [TLS/SSL Configuration](#tlsssl-configuration)
12. [Monitoring and Logging](#monitoring-and-logging)
13. [Troubleshooting Common Issues](#troubleshooting-common-issues)
14. [Best Practices](#best-practices)
15. [Cost Considerations](#cost-considerations)
16. [Summary](#summary)

## Introduction to ALB

AWS Application Load Balancer (ALB) is a Layer 7 load balancer that routes HTTP/HTTPS traffic to different targets based on the content of the request. In the context of Kubernetes, ALBs can be provisioned automatically through the AWS Load Balancer Controller to expose services running in the cluster.

**Key Features of ALB:**
- Content-based routing (path-based, host-based)
- Support for WebSockets and HTTP/2
- Integration with AWS WAF and AWS Shield for security
- Support for sticky sessions
- Detailed access logs
- Health checks for targets
- TLS termination

## ALB Architecture in the 3-Tier Project

In this 3-tier application project, the ALB serves as the entry point for all external traffic, routing requests to either the frontend or backend services based on URL paths.

```
                                  ┌─────────────────┐
                                  │                 │
                                  │  Internet       │
                                  │                 │
                                  └────────┬────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                   Application Load Balancer                         │
│                                                                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
                 ▼                             ▼
┌────────────────────────────┐    ┌────────────────────────────┐
│                            │    │                            │
│  Frontend Service          │    │  Backend Service           │
│  (Path: /)                 │    │  (Path: /api)              │
│                            │    │                            │
└────────────────────────────┘    └────────────────────────────┘
         │                                     │
         ▼                                     ▼
┌────────────────────────────┐    ┌────────────────────────────┐
│                            │    │                            │
│  Frontend Pods             │    │  Backend Pods              │
│  (React.js on port 80)     │    │  (Flask API on port 8000)  │
│                            │    │                            │
└────────────────────────────┘    └────────────────────────────┘
                                            │
                                            ▼
                                   ┌────────────────────────────┐
                                   │                            │
                                   │  RDS PostgreSQL Database   │
                                   │  (Port 5432)               │
                                   │                            │
                                   └────────────────────────────┘
```

## Kubernetes Ingress and Ingress Controllers

### What is Kubernetes Ingress?

Ingress is a Kubernetes API object that manages external access to services within a cluster, typically HTTP/HTTPS. It provides:

- **Load balancing**: Distributes traffic among pods
- **SSL/TLS termination**: Handles HTTPS traffic
- **Name-based virtual hosting**: Routes traffic based on hostnames
- **Path-based routing**: Routes traffic based on URL paths
- **Custom rules**: Defines how traffic should be routed

Ingress acts as a layer of abstraction between the external world and your Kubernetes services, allowing you to define routing rules in a declarative way.

### Why Use Ingress?

Before Ingress, exposing services to the outside world in Kubernetes had limitations:

1. **NodePort Service**: Exposes a service on a static port on each node, but:
   - Limited to ports 30000-32767
   - Requires external load balancer for production use
   - No built-in path-based routing

2. **LoadBalancer Service**: Creates an external load balancer, but:
   - Each service requires its own load balancer (costly)
   - No built-in content-based routing
   - Limited to a single service per load balancer

Ingress solves these problems by:
- Allowing multiple services to share a single load balancer
- Supporting advanced routing capabilities
- Providing a standardized way to configure external access

### Ingress vs. Service

| Feature | Service (LoadBalancer type) | Ingress |
|---------|---------------------------|---------|
| Protocol Support | Any TCP/UDP protocol | HTTP/HTTPS only |
| Routing | Simple port-based | Content-based (paths, hosts) |
| Load Balancers | One per service | One for multiple services |
| SSL/TLS | Basic support | Advanced termination, SNI |
| Cost | Higher (multiple LBs) | Lower (shared LB) |
| Configuration | Simple | More complex but flexible |

### Ingress Controllers

An Ingress resource by itself doesn't do anything. It requires an **Ingress Controller** to implement the rules defined in the Ingress resource.

**What is an Ingress Controller?**

An Ingress Controller is a specialized application that:
- Watches for Ingress resources in the Kubernetes API
- Translates Ingress rules into configuration for a specific load balancer
- Provisions and configures the actual load balancer infrastructure
- Updates the status of Ingress resources

**Popular Ingress Controllers:**

1. **NGINX Ingress Controller**: Uses NGINX as the load balancer
2. **AWS Load Balancer Controller**: Provisions AWS ALBs and NLBs
3. **Traefik**: Modern HTTP reverse proxy and load balancer
4. **HAProxy Ingress**: Based on HAProxy
5. **Istio Ingress Gateway**: Part of the Istio service mesh

Each controller has its own set of features, annotations, and configuration options.

### Ingress Controller Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                         │
│                                                                 │
│  ┌─────────────────┐      ┌─────────────────┐                   │
│  │                 │      │                 │                   │
│  │ Ingress         │      │ Ingress         │                   │
│  │ Controller      │◄────►│ Resources       │                   │
│  │ (Deployment)    │      │ (API Objects)   │                   │
│  │                 │      │                 │                   │
│  └────────┬────────┘      └─────────────────┘                   │
│           │                                                     │
│           │ Configures                                          │
│           ▼                                                     │
│  ┌─────────────────┐      ┌─────────────────┐                   │
│  │                 │      │                 │                   │
│  │ Load Balancer   │      │ Kubernetes      │                   │
│  │ (External or    │◄────►│ Services        │                   │
│  │  Internal)      │      │                 │                   │
│  │                 │      │                 │                   │
│  └────────┬────────┘      └─────────┬───────┘                   │
│           │                         │                           │
└───────────┼─────────────────────────┼───────────────────────────┘
            │                         │
            │                         │
            ▼                         ▼
┌───────────────────────┐    ┌─────────────────┐
│                       │    │                 │
│ External Traffic      │    │ Pod 1           │
│                       │    │                 │
└───────────────────────┘    └─────────────────┘
                                      │
                                      │
                                      ▼
                             ┌─────────────────┐
                             │                 │
                             │ Pod 2           │
                             │                 │
                             └─────────────────┘
                                      │
                                      │
                                      ▼
                             ┌─────────────────┐
                             │                 │
                             │ Pod 3           │
                             │                 │
                             └─────────────────┘
```

### Ingress Resource Example

Here's a basic Ingress resource example:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example-ingress
  namespace: default
  annotations:
    # Controller-specific annotations
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx  # Specifies which controller to use
  rules:
  - host: example.com      # Optional: Host-based routing
    http:
      paths:
      - path: /app1
        pathType: Prefix
        backend:
          service:
            name: app1-service
            port:
              number: 80
      - path: /app2
        pathType: Prefix
        backend:
          service:
            name: app2-service
            port:
              number: 80
  # Optional: TLS configuration
  tls:
  - hosts:
    - example.com
    secretName: example-tls-cert
```

This Ingress resource:
1. Uses the NGINX Ingress Controller
2. Routes traffic based on the URL path:
   - `/app1/*` goes to the `app1-service`
   - `/app2/*` goes to the `app2-service`
3. Configures TLS using a certificate stored in a Kubernetes Secret

### IngressClass Resource

The IngressClass resource defines which controller should implement the Ingress:

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: nginx
  # Optional: Make this the default class
  annotations:
    ingressclass.kubernetes.io/is-default-class: "true"
spec:
  controller: nginx.org/ingress-controller
  # Optional: Parameters for the controller
  parameters:
    apiGroup: k8s.example.com
    kind: NginxParameters
    name: nginx-config
```

### Ingress in the 3-Tier Application

In our 3-tier application, we use the AWS Load Balancer Controller as our Ingress Controller. It watches for Ingress resources and creates AWS Application Load Balancers (ALBs) to implement the routing rules.

The Ingress resource defines:
1. Path-based routing:
   - `/api/*` routes to the backend service
   - `/*` routes to the frontend service
2. The ALB configuration through annotations

The AWS Load Balancer Controller translates this Ingress resource into:
1. An AWS Application Load Balancer
2. Target Groups for each service
3. Listeners and rules for routing
4. Security groups for network access

### Ingress Controller Deployment

In our project, the AWS Load Balancer Controller is deployed as a Kubernetes Deployment in the `kube-system` namespace:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aws-load-balancer-controller
  namespace: kube-system
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: aws-load-balancer-controller
  template:
    metadata:
      labels:
        app.kubernetes.io/name: aws-load-balancer-controller
    spec:
      serviceAccountName: aws-load-balancer-controller
      containers:
      - name: aws-load-balancer-controller
        image: amazon/aws-load-balancer-controller:v2.4.0
        args:
          - --cluster-name=my-eks-cluster
          - --ingress-class=alb
          # Additional args...
```

### Ingress Workflow in the 3-Tier Application

1. **Create IngressClass**: Define the `alb` IngressClass that specifies the AWS Load Balancer Controller
2. **Create Ingress Resource**: Define the routing rules for the frontend and backend services
3. **Controller Detects Ingress**: The AWS Load Balancer Controller watches for Ingress resources
4. **ALB Provisioning**: The controller creates an ALB and configures it according to the Ingress spec
5. **Traffic Routing**: External traffic hits the ALB, which routes it to the appropriate service based on the path

### Benefits of Using Ingress in the 3-Tier Application

1. **Cost Efficiency**: A single ALB serves both frontend and backend services
2. **Simplified Management**: Declarative configuration through Kubernetes resources
3. **Advanced Routing**: Path-based routing directs traffic to the appropriate service
4. **Scalability**: The ALB automatically scales with traffic
5. **Integration**: Seamless integration with AWS services and EKS
6. **Security**: TLS termination and security group management

## AWS Load Balancer Controller

The AWS Load Balancer Controller is a Kubernetes controller that helps manage Elastic Load Balancers for a Kubernetes cluster. In this project, it's deployed within the EKS cluster in the `kube-system` namespace.

**Installation and Configuration:**

```bash
# Create IAM policy for the controller
aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json

# Create service account for the controller
eksctl create iamserviceaccount \
  --cluster=bootcamp-dev-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install the controller using Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=bootcamp-dev-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

**Verification:**

```bash
# Check if the controller is running
kubectl get deployment -n kube-system aws-load-balancer-controller

# Check the controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller
```

## Ingress Resource Configuration

The ALB is provisioned through a Kubernetes Ingress resource. Here's the configuration used in this project:

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: alb
  annotations:
    ingressclass.kubernetes.io/is-default-class: "false"
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
  ingressClassName: "alb"
  rules:
  - http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

**Key Annotations:**

- `alb.ingress.kubernetes.io/scheme: "internet-facing"`: Creates a public-facing ALB accessible from the internet
- `alb.ingress.kubernetes.io/target-type: "ip"`: Routes traffic directly to pod IPs rather than node IPs
- `alb.ingress.kubernetes.io/healthcheck-path: "/"`: Configures the health check endpoint for the ALB

## ALB Components and Workflow

When the AWS Load Balancer Controller processes the Ingress resource, it creates several AWS resources:

1. **Application Load Balancer**: The main load balancer that receives traffic from the internet
2. **Target Groups**: One for each backend service (frontend and backend in this case)
3. **Listeners**: HTTP/HTTPS listeners on ports 80/443
4. **Rules**: Path-based routing rules that direct traffic to the appropriate target group
5. **Security Groups**: To control traffic to and from the ALB

**Workflow:**

1. User sends a request to the ALB's DNS name
2. ALB receives the request and evaluates the path:
   - If the path starts with `/api`, the request is routed to the backend service
   - If the path starts with `/`, the request is routed to the frontend service
3. The target group forwards the request to a healthy pod
4. The pod processes the request and sends a response
5. The response is sent back to the user through the ALB

## Security Group Configuration

The ALB uses two security groups:

1. **Shared Load Balancer Security Group** (`sg-04cce232dcd1fb94e`):
   - Name: `k8s-traffic-bootcampdevcluster-fb83cad852`
   - Description: `[k8s] Shared Backend SecurityGroup for LoadBalancer`
   - Purpose: Common security group used by multiple load balancers

2. **Application-Specific Load Balancer Security Group** (`sg-04fb7bcc9a38ec5bd`):
   - Name: `k8s-3tierapp-3tierapp-0d8d19d336`
   - Description: `[k8s] Managed SecurityGroup for LoadBalancer`
   - Purpose: Specific to the 3-tier application's ingress

The AWS Load Balancer Controller automatically creates and manages these security groups and their rules.

## Subnet Configuration and Requirements

For the ALB to be provisioned correctly, the subnets must be properly tagged:

- **Public subnets** (for internet-facing ALBs): `kubernetes.io/role/elb=1`
- **Private subnets** (for internal ALBs): `kubernetes.io/role/internal-elb=1`

In this project, the public subnets are tagged with `kubernetes.io/role/elb=1`:

```bash
# Get public subnet IDs
PUBLIC_SUBNETS=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=*public*" --query "Subnets[*].SubnetId" --output text)

# Tag public subnets for ALB use
for subnet in $PUBLIC_SUBNETS; do
  aws ec2 create-tags --resources $subnet --tags Key=kubernetes.io/role/elb,Value=1 --region us-east-1
done
```

## Path-Based Routing

The ALB in this project uses path-based routing to direct traffic to different services:

- Requests to `/api/*` are routed to the backend service (Flask API)
- All other requests (`/`) are routed to the frontend service (React.js)

This is configured in the Ingress resource's `rules` section:

```yaml
rules:
- http:
    paths:
    - path: /api
      pathType: Prefix
      backend:
        service:
          name: backend
          port:
            number: 8000
    - path: /
      pathType: Prefix
      backend:
        service:
          name: frontend
          port:
            number: 80
```

## Health Checks

The ALB performs health checks on the target pods to ensure they're healthy before routing traffic to them. In this project, the health check path is configured to `/`:

```yaml
annotations:
  alb.ingress.kubernetes.io/healthcheck-path: "/"
```

Additional health check parameters can be configured:

```yaml
alb.ingress.kubernetes.io/healthcheck-protocol: HTTP
alb.ingress.kubernetes.io/healthcheck-port: traffic-port
alb.ingress.kubernetes.io/healthcheck-interval-seconds: '15'
alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
alb.ingress.kubernetes.io/success-codes: '200'
alb.ingress.kubernetes.io/healthy-threshold-count: '2'
alb.ingress.kubernetes.io/unhealthy-threshold-count: '2'
```

## TLS/SSL Configuration

For secure HTTPS connections, the ALB can be configured with an SSL certificate from AWS Certificate Manager (ACM):

```yaml
annotations:
  alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:region:account-id:certificate/certificate-id
  alb.ingress.kubernetes.io/ssl-policy: ELBSecurityPolicy-TLS-1-2-2017-01
  alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
  alb.ingress.kubernetes.io/actions.ssl-redirect: '{"Type": "redirect", "RedirectConfig": {"Protocol": "HTTPS", "Port": "443", "StatusCode": "HTTP_301"}}'
```

## Monitoring and Logging

The ALB provides several monitoring and logging capabilities:

1. **Access Logs**: Can be enabled to log all requests to an S3 bucket:

```yaml
annotations:
  alb.ingress.kubernetes.io/load-balancer-attributes: access_logs.s3.enabled=true,access_logs.s3.bucket=my-alb-logs,access_logs.s3.prefix=my-app
```

2. **CloudWatch Metrics**: ALB automatically publishes metrics to CloudWatch, including:
   - Request count
   - Latency
   - HTTP status codes
   - Healthy/unhealthy host count

3. **Controller Logs**: The AWS Load Balancer Controller logs can be checked for troubleshooting:

```bash
kubectl logs -n kube-system deployment/aws-load-balancer-controller
```

## Troubleshooting Common Issues

### 1. ALB Not Creating

If the ALB is not being created after applying the Ingress resource:

```bash
# Check ingress status
kubectl get ingress -n 3-tier-app-eks
kubectl describe ingress 3-tier-app-ingress -n 3-tier-app-eks

# Check controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller

# Check if subnets are properly tagged
aws ec2 describe-subnets --filters "Name=tag:kubernetes.io/role/elb,Values=1" --query "Subnets[*].SubnetId" --output text
```

Common causes:
- Missing subnet tags
- IAM permissions issues
- Controller not running

### 2. Traffic Not Reaching Services

If the ALB is created but traffic is not reaching the services:

```bash
# Check target group health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>

# Check service endpoints
kubectl get endpoints -n 3-tier-app-eks

# Check pod logs
kubectl logs -n 3-tier-app-eks -l app=frontend
kubectl logs -n 3-tier-app-eks -l app=backend
```

Common causes:
- Health checks failing
- Security group rules blocking traffic
- Service selector not matching pod labels

### 3. Stuck Ingress Deletion

If an Ingress resource is stuck in the terminating state:

```bash
# Force delete stuck ingress
kubectl patch ingress 3-tier-app-ingress -n 3-tier-app-eks -p '{"metadata":{"finalizers":[]}}' --type=merge
kubectl delete ingress 3-tier-app-ingress -n 3-tier-app-eks --grace-period=0 --force
```

## Best Practices

1. **Use IP Targeting Mode**: Set `alb.ingress.kubernetes.io/target-type: "ip"` to route traffic directly to pod IPs for better granularity.

2. **Implement Proper Health Checks**: Configure health checks that accurately reflect the health of your application.

3. **Enable Access Logs**: Enable access logs to an S3 bucket for troubleshooting and audit purposes.

4. **Use TLS**: Configure HTTPS with a valid certificate for secure communication.

5. **Tag Subnets Properly**: Ensure subnets are properly tagged for ALB discovery.

6. **Implement Cross-Zone Load Balancing**: Enable cross-zone load balancing for better distribution of traffic:

```yaml
annotations:
  alb.ingress.kubernetes.io/load-balancer-attributes: routing.http.drop_invalid_header_fields.enabled=true,routing.http2.enabled=true,load_balancing.cross_zone.enabled=true
```

7. **Set Resource Tags**: Add tags to the ALB for better resource management:

```yaml
annotations:
  alb.ingress.kubernetes.io/tags: Environment=dev,Team=platform
```

8. **Configure Idle Timeout**: Set an appropriate idle timeout for your application:

```yaml
annotations:
  alb.ingress.kubernetes.io/load-balancer-attributes: idle_timeout.timeout_seconds=60
```

## Cost Considerations

ALBs incur costs based on:
1. **Hourly rate**: Each ALB has an hourly charge
2. **LCU usage**: Load Balancer Capacity Units based on:
   - New connections per second
   - Active connections per minute
   - Processed bytes
   - Rule evaluations

To optimize costs:
- Use shared ALBs for multiple applications when possible
- Consider using Network Load Balancers for simple TCP/UDP load balancing
- Monitor and right-size based on actual usage
- Clean up unused resources

## Summary

The Application Load Balancer (ALB) is a critical component in the 3-tier application architecture, providing:

1. **Intelligent Traffic Routing**: Directs requests to the appropriate service based on the URL path
2. **Health Monitoring**: Ensures traffic is only sent to healthy pods
3. **Security**: Provides TLS termination and integrates with security services
4. **Scalability**: Automatically scales to handle varying traffic loads
5. **Observability**: Provides logs and metrics for monitoring and troubleshooting

In this project, the ALB is provisioned and managed by the AWS Load Balancer Controller, which translates Kubernetes Ingress resources into AWS resources. The controller handles the creation and configuration of the ALB, target groups, listeners, rules, and security groups, making it easy to expose Kubernetes services to the internet in a secure and scalable way.

By following the best practices and troubleshooting steps outlined in this document, you can ensure that your ALB is properly configured and functioning optimally for your 3-tier application.
