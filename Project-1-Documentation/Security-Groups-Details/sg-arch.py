#!/usr/bin/env python3
"""
RouteClouds Security Group Architecture Diagram Generator

This script generates a diagram visualizing the security group architecture
for the RouteClouds EKS application, showing relationships, roles, and rules based on
the actual security group analysis data.

Requirements:
    pip install diagrams graphviz
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.security import Shield
from diagrams.aws.compute import EKS
from diagrams.aws.database import RDS
from diagrams.aws.network import ELB, VPC, InternetGateway
from diagrams.aws.general import Users
from diagrams.k8s.compute import Pod
from diagrams.k8s.network import Ingress

# Define diagram attributes
diagram_attrs = {
    "fontsize": "20",
    "pad": "0.5",
    "splines": "ortho",
    "nodesep": "0.8",
    "ranksep": "1.0",
    "fontname": "Sans-Serif",
    "fontcolor": "#2D3436",
    "bgcolor": "white",
}

# Define node attributes
node_attrs = {
    "fontsize": "12",
    "fontname": "Sans-Serif",
    "fontcolor": "#2D3436",
    "width": "1.4",
    "height": "1.4",
}

# Define edge attributes
edge_attrs = {
    "fontsize": "10",
    "fontname": "Sans-Serif",
    "fontcolor": "#2D3436",
}

# Create the diagram
with Diagram(
    "RouteClouds EKS Security Group Architecture",
    show=True,
    direction="LR",
    graph_attr=diagram_attrs,
    node_attr=node_attrs,
    edge_attr=edge_attrs,
    filename="routeclouds_security_group_architecture"
) as diag:
    
    # External entities
    internet = Users("Internet")
    
    # VPC container
    with Cluster("VPC: routeclouds-vpc"):
        igw = InternetGateway("Internet Gateway")
        
        # Application-Specific Load Balancer Security Group
        with Cluster("App LB Security Group\nsg-04fb7bcc9a38ec5bd"):
            app_lb_sg = Shield("k8s-routeclouds-app-0d8d19d336")
            app_lb = Ingress("Application Ingress")
        
        # Shared Load Balancer Security Group
        with Cluster("Shared LB Security Group\nsg-04cce232dcd1fb94e"):
            shared_lb_sg = Shield("k8s-traffic-routeclouds-eks-cluster-fb83cad852")
            shared_lb = ELB("Shared Load Balancer")
        
        # EKS Cluster
        with Cluster("EKS Cluster: routeclouds-eks-cluster"):
            
            # Control Plane Security Group
            with Cluster("Control Plane Security Group\nsg-0a2172ac09fcb8b08"):
                control_plane_sg = Shield("eks-cluster-sg-routeclouds-eks-cluster-536903144")
                control_plane = EKS("EKS Control Plane")
            
            # Cluster Security Group
            with Cluster("Cluster Security Group\nsg-07dac932c272e2161"):
                cluster_sg = Shield("routeclouds-eks-cluster-sg")
                api_server = EKS("Kubernetes API Server")
            
            # Node Security Group
            with Cluster("Node Security Group\nsg-03f55598554824f73"):
                node_sg = Shield("routeclouds-eks-cluster-node-2025070705415142120000000a")
                pods = [Pod("App Pod 1"), 
                        Pod("App Pod 2"),
                        Pod("App Pod 3")]
        
        # RDS Security Group
        with Cluster("RDS Security Group\nsg-028044234144db4c1"):
            rds_sg = Shield("dev-rds-sg")
            db = RDS("PostgreSQL Database")
    
    # Define traffic flows with detailed labels based on actual security group rules
    
    # Internet to Load Balancers
    internet >> Edge(label="HTTP/HTTPS\nPorts: 80, 443") >> igw
    igw >> Edge(label="HTTP/HTTPS") >> app_lb
    igw >> Edge(label="HTTP/HTTPS") >> shared_lb
    
    # Load Balancers to Nodes
    shared_lb >> Edge(label="TCP 80-8000") >> node_sg
    app_lb >> Edge(label="App Traffic") >> node_sg
    
    # Node to API Server
    node_sg >> Edge(label="TCP 443") >> cluster_sg
    
    # API Server to Nodes
    cluster_sg >> Edge(label="TCP 443, 10250") >> node_sg
    
    # Control Plane Communication
    control_plane_sg >> Edge(label="All protocols (self)") >> control_plane_sg
    control_plane >> Edge(label="Management") >> api_server
    
    # Nodes to Database
    node_sg >> Edge(label="Via Cluster SG") >> cluster_sg
    cluster_sg >> Edge(label="TCP 5432") >> rds_sg
    rds_sg >> db
    
    # Security Concern: Public Database Access
    internet >> Edge(color="red", style="dashed", label="SECURITY CONCERN:\nPublic Access\nTCP 5432") >> rds_sg

# Add a legend explaining the diagram
with Diagram(
    "RouteClouds Security Group Architecture Legend",
    show=True,
    direction="TB",
    graph_attr={"fontsize": "14"},
    outformat="png",
    filename="routeclouds_sg_architecture_legend"
) as legend:
    
    with Cluster("Legend"):
        Shield("Security Group")
        
        with Cluster("Components"):
            Users("External Entity")
            ELB("AWS Service")
            Pod("Kubernetes Resource")
        
        with Cluster("Security Concerns"):
            Edge(color="red", style="dashed", label="Security Vulnerability")
        
        with Cluster("Traffic Flow"):
            Edge(label="Allowed Traffic\nProtocol: Port(s)")