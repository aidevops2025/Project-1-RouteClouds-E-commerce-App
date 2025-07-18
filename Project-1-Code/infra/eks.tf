module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.21.0"

  cluster_name    = "${var.prefix}-${var.environment}-cluster"
  cluster_version = "1.28"

  # Optional
  cluster_endpoint_public_access = true

  vpc_id     = module.eks_network.vpc_id
  subnet_ids = module.eks_network.private_subnets

  # Add CNI add-on with before_compute = true
  cluster_addons = {
    vpc-cni = {
      most_recent    = true
      before_compute = true
    }
    kube-proxy = {
      most_recent = true
    }
    coredns = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    example = {
      ami_type       = "AL2023_x86_64_STANDARD"
      instance_types = ["t3.medium"]

      min_size     = 2
      max_size     = 4
      desired_size = 2

      tags = {
        Environment = var.environment
        Terraform   = "true"
        repo        = "DevOpsDojo"
      }
    }
  }

  tags = {
    Environment = var.environment
    Terraform   = "true"
    repo        = "DevOpsDojo"
  }
}
