# gemini-arch.py
from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import EKS, EC2
from diagrams.aws.database import RDS
from diagrams.aws.network import VPC, ELB, PrivateSubnet, PublicSubnet, InternetGateway, NATGateway
from diagrams.aws.security import IAM, OIDC
from diagrams.aws.storage import ECR
from diagrams.onprem.ci import GithubActions
from diagrams.k8s.clusterconfig import HPA
from diagrams.k8s.infra import Node
from diagrams.k8s.network import Ing, Svc
from diagrams.k8s.podconfig import ConfigMap, Secret
from diagrams.k8s.workload import Deployment, Job
from diagrams.onprem.vcs import Github
from diagrams.onprem.monitoring import Prometheus, Grafana

graph_attr = {
    "fontsize": "12",
    "bgcolor": "transparent"
}

with Diagram("AWS 3-Tier EKS Architecture", show=False, filename="aws_3_tier_eks_architecture", graph_attr=graph_attr):

    developer = Github("Developer")

    with Cluster("GitHub"):
        github_repo = Github("3-Tier App Repo")
        github_actions = GithubActions("CI/CD Pipeline")

    with Cluster("AWS Cloud"):
        oidc_provider = OIDC("GitHub OIDC Provider")
        ci_cd_role = IAM("GitHub Actions Role (IRSA)")

        with Cluster("VPC"):
            vpc = VPC("VPC")
            igw = InternetGateway("Internet Gateway")
            
            with Cluster("Public Subnets"):
                public_subnets = [PublicSubnet("Public Subnet 1"), PublicSubnet("Public Subnet 2")]
                alb = ELB("ALB")

            with Cluster("Private Subnets"):
                private_subnets = [PrivateSubnet("Private Subnet 1"), PrivateSubnet("Private Subnet 2")]
                nat_gateway = NATGateway("NAT Gateway")
                
                with Cluster("EKS Cluster"):
                    eks_cluster = EKS("EKS Control Plane")
                    
                    with Cluster("EKS Managed Node Group"):
                        nodes = [Node("Node 1"), Node("Node 2")]

                    with Cluster("Kubernetes Resources (3-tier-app-eks Namespace)"):
                        ingress = Ing("Ingress")
                        
                        with Cluster("Frontend Tier"):
                            frontend_svc = Svc("frontend-svc")
                            frontend_pods = Deployment("frontend-deploy")
                            
                        with Cluster("Backend Tier"):
                            backend_svc = Svc("backend-svc")
                            backend_pods = Deployment("backend-deploy")
                            hpa = HPA("HPA")
                            
                        with Cluster("Data & Config"):
                            db_service = Svc("db-external-svc")
                            secrets = Secret("DB Secrets")
                            configmap = ConfigMap("App Config")
                            migration_job = Job("Migration Job")

                with Cluster("Database Tier"):
                    rds_instance = RDS("PostgreSQL RDS")

        ecr = ECR("ECR Image Registry")

        # Monitoring (Optional but included in docs)
        with Cluster("Monitoring Namespace"):
            monitoring_ingress = Ing("Monitoring Ingress")
            prometheus = Prometheus("Prometheus")
            grafana = Grafana("Grafana")


    # CI/CD Flow
    developer >> Edge(label="push/pr") >> github_repo >> Edge(label="trigger") >> github_actions
    github_actions >> Edge(label="assume role via OIDC") >> oidc_provider >> ci_cd_role
    ci_cd_role >> Edge(label="grants permission") >> eks_cluster
    ci_cd_role >> Edge(label="grants permission") >> ecr
    github_actions >> Edge(label="build & push image") >> ecr
    github_actions >> Edge(label="kubectl apply") >> eks_cluster

    # Traffic Flow
    igw >> alb >> ingress
    ingress >> Edge(label="/") >> frontend_svc >> frontend_pods
    ingress >> Edge(label="/api") >> backend_svc >> backend_pods
    frontend_pods >> Edge(label="calls API") >> backend_svc
    backend_pods >> Edge(label="connects to") >> db_service >> rds_instance

    # K8s resource relations
    backend_pods << Edge(color="darkgreen") << hpa
    backend_pods - Edge(label="uses", style="dashed", color="grey") - secrets
    backend_pods - Edge(label="uses", style="dashed", color="grey") - configmap
    migration_job - Edge(label="uses", style="dashed", color="grey") - secrets
    migration_job - Edge(label="uses", style="dashed", color="grey") - configmap
    migration_job >> Edge(label="migrates schema") >> rds_instance
    
    # Network relations
    vpc >> public_subnets
    vpc >> private_subnets
    public_subnets >> nat_gateway >> private_subnets
    
    # Monitoring Flow
    alb >> monitoring_ingress
    monitoring_ingress >> prometheus
    monitoring_ingress >> grafana
    prometheus >> Edge(label="scrapes") >> backend_svc
    grafana >> Edge(label="queries") >> prometheus
