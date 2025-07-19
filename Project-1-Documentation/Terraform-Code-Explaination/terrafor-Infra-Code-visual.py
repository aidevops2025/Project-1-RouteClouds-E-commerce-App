from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import EKS
from diagrams.aws.network import VPC, PrivateSubnet, PublicSubnet, NATGateway
from diagrams.aws.security import KMS, IAMRole, IAM
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.iac import Terraform
from diagrams.generic.blank import Blank

with Diagram("RouteClouds Terraform Infra Code Workflow (Step-by-Step)", show=False, direction="TB"):
    # Step 1: Variables and Data
    tfvars = Blank("Step 1: terraform.tfvars")
    variables = Blank("Step 1: variables.tf")
    data = Blank("Step 1: data.tf")

    # Step 2: Network
    with Cluster("Step 2: Network (network.tf)"):
        vpc = VPC("routeclouds-vpc")
        pub_subnet = PublicSubnet("Public Subnets")
        priv_subnet = PrivateSubnet("Private Subnets")
        nat = NATGateway("NAT Gateway")
        vpc >> [pub_subnet, priv_subnet]
        pub_subnet >> nat
        priv_subnet >> nat

    # Step 3: EKS
    with Cluster("Step 3: EKS (eks.tf)"):
        eks = EKS("routeclouds-eks-cluster")
        eks_nodes = EKS("routeclouds-node-group")
        eks >> eks_nodes

    # Step 5: OIDC/GitHub Actions
    with Cluster("Step 5: OIDC/GitHub (oidc.tf, modules/oidc/)"):
        oidc_role = IAMRole("OIDC IAM Role")
        github = GithubActions("GitHub Actions")
        oidc_role >> github

    # Step 6: Outputs
    output = Blank("Step 6: output.tf")

    # Relationships and Workflow
    tfvars >> variables
    variables >> [vpc, eks, oidc_role]
    data >> [vpc, eks]
    vpc >> eks
    eks >> oidc_role
    oidc_role >> github
    output << [oidc_role, eks]

    # Optional: aws-oidc-github-cli helper scripts
    helper = Blank("aws-oidc-github-cli/")
    helper >> oidc_role
