#!/usr/bin/env python3
"""
RouteClouds E-Commerce Deployment Architecture Diagram

This script generates a comprehensive diagram showing the complete deployment
architecture for the RouteClouds 3-tier e-commerce application on AWS EKS.

Requirements:
    pip install diagrams graphviz
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import EKS, EC2
from diagrams.aws.database import RDS
from diagrams.aws.network import ALB, InternetGateway, NATGateway
from diagrams.aws.security import IAMRole
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.container import Docker
from diagrams.k8s.compute import Pod, Deployment
from diagrams.k8s.network import Service, Ingress
from diagrams.generic.blank import Blank
from diagrams.programming.framework import React
from diagrams.programming.language import NodeJS, TypeScript
from diagrams.generic.database import SQL
from diagrams.aws.general import Users

# Define diagram attributes
diagram_attrs = {
    "fontsize": "20",
    "pad": "0.5",
    "splines": "ortho",
    "nodesep": "0.8",
    "ranksep": "1.2",
    "fontname": "Sans-Serif",
    "fontcolor": "#2D3436",
    "bgcolor": "white",
}

node_attrs = {
    "fontsize": "12",
    "fontname": "Sans-Serif",
    "fontcolor": "#2D3436",
    "width": "1.4",
    "height": "1.4",
}

edge_attrs = {
    "fontsize": "10",
    "fontname": "Sans-Serif",
    "fontcolor": "#2D3436",
}

# Main Architecture Diagram
with Diagram(
    "RouteClouds E-Commerce - Complete Deployment Architecture",
    show=True,
    direction="TB",
    graph_attr=diagram_attrs,
    node_attr=node_attrs,
    edge_attr=edge_attrs,
    filename="routeclouds_deployment_architecture"
) as main_diag:
    
    # External Users
    users = Users("Internet Users")
    
    # CI/CD Pipeline
    with Cluster("CI/CD Pipeline"):
        github = GithubActions("GitHub Actions")
        docker_hub = Docker("Docker Hub\nawsfreetier30")
    
    # AWS Cloud
    with Cluster("AWS Cloud (us-east-1)"):
        
        # VPC and Networking
        with Cluster("VPC: vpc-0a3065aa3dd1bd913"):
            igw = InternetGateway("Internet Gateway")
            
            # Public Subnets
            with Cluster("Public Subnets"):
                alb = ALB("Application Load Balancer")
                nat = NATGateway("NAT Gateway")
            
            # Private Subnets
            with Cluster("Private Subnets"):
                
                # EKS Cluster
                with Cluster("EKS Cluster: routeclouds-prod-cluster"):
                    
                    # Control Plane
                    eks_control = EKS("EKS Control Plane")
                    
                    # Node Groups
                    with Cluster("Managed Node Group"):
                        node1 = EC2("Worker Node 1\nt3.medium")
                        node2 = EC2("Worker Node 2\nt3.medium")
                    
                    # Kubernetes Resources
                    with Cluster("Namespace: routeclouds-ns"):
                        
                        # Frontend Tier
                        with Cluster("Frontend Tier"):
                            frontend_svc = Service("Frontend Service\nClusterIP")
                            frontend_deploy = Deployment("Frontend Deployment")
                            frontend_pod1 = Pod("Frontend Pod 1\nReact + Vite\nPort: 80")
                            frontend_pod2 = Pod("Frontend Pod 2\nReact + Vite\nPort: 80")
                        
                        # Backend Tier
                        with Cluster("Backend Tier"):
                            backend_svc = Service("Backend Service\nClusterIP")
                            backend_deploy = Deployment("Backend Deployment")
                            backend_pod1 = Pod("Backend Pod 1\nNode.js + Express\nPort: 8000")
                            backend_pod2 = Pod("Backend Pod 2\nNode.js + Express\nPort: 8000")
                        
                        # Ingress Controller
                        ingress = Ingress("AWS Load Balancer\nController")
                
                # Database
                with Cluster("Database Subnet"):
                    rds = RDS("RDS PostgreSQL\nrouteclouds_ecommerce_db\nPort: 5432")
    
    # Traffic Flow - External to Internal
    users >> Edge(label="HTTPS/HTTP\nPort: 80, 443") >> igw
    igw >> Edge(label="Load Balance") >> alb
    alb >> Edge(label="Ingress Rules") >> ingress
    
    # Ingress to Services
    ingress >> Edge(label="/ path\nPort: 80") >> frontend_svc
    ingress >> Edge(label="/api path\nPort: 8000") >> backend_svc
    
    # Services to Deployments
    frontend_svc >> frontend_deploy
    backend_svc >> backend_deploy
    
    # Deployments to Pods
    frontend_deploy >> [frontend_pod1, frontend_pod2]
    backend_deploy >> [backend_pod1, backend_pod2]
    
    # Backend to Database
    backend_pod1 >> Edge(label="SQL Queries\nPort: 5432") >> rds
    backend_pod2 >> Edge(label="SQL Queries\nPort: 5432") >> rds
    
    # Node Management
    eks_control >> Edge(label="Manage") >> [node1, node2]
    [frontend_pod1, frontend_pod2, backend_pod1, backend_pod2] >> [node1, node2]
    
    # CI/CD Flow
    github >> Edge(label="Build & Push\nImages") >> docker_hub
    docker_hub >> Edge(label="Pull Images") >> [frontend_deploy, backend_deploy]

# Technology Stack Diagram
with Diagram(
    "RouteClouds Technology Stack",
    show=True,
    direction="LR",
    graph_attr={"fontsize": "16"},
    filename="routeclouds_tech_stack"
) as tech_diag:
    
    with Cluster("Frontend Technologies"):
        react = React("React.js")
        vite = Blank("Vite")
        tailwind = Blank("TailwindCSS")
        typescript_fe = TypeScript("TypeScript")
    
    with Cluster("Backend Technologies"):
        nodejs = NodeJS("Node.js")
        express = Blank("Express.js")
        typescript_be = TypeScript("TypeScript")
        jwt = Blank("JWT Auth")
    
    with Cluster("Database"):
        postgres = SQL("PostgreSQL")
        rds_tech = RDS("AWS RDS")
    
    with Cluster("Infrastructure"):
        eks_tech = EKS("AWS EKS")
        terraform = Blank("Terraform")
        k8s = Blank("Kubernetes")
    
    with Cluster("DevOps"):
        github_tech = GithubActions("GitHub Actions")
        docker_tech = Docker("Docker")
        dockerhub = Blank("Docker Hub")
    
    # Technology relationships
    react >> vite >> tailwind >> typescript_fe
    nodejs >> express >> typescript_be >> jwt
    postgres >> rds_tech
    eks_tech >> terraform >> k8s
    github_tech >> docker_tech >> dockerhub

print("✅ All diagrams generated successfully!")
print("📊 Generated files:")
print("   - routeclouds_deployment_architecture.png")
print("   - routeclouds_tech_stack.png")
print("\n🚀 Run the script: python3 routeclouds-deployment-architecture-fixed.py")