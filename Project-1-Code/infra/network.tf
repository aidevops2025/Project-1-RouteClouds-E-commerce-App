## using a public module ##
module "eks_network" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"

  name = "${var.prefix}-${var.environment}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24", "10.0.4.0/24"]

  enable_nat_gateway = true  #  Use a single NAT Gateway
  single_nat_gateway = true  # Keep costs low by using only one NAT Gateway

  enable_dns_hostnames = true
  enable_dns_support   = true

  # These tags are critical for EKS to discover subnets
  # The format must match exactly what EKS expects
  public_subnet_tags = {
    "kubernetes.io/cluster/${var.prefix}-${var.environment}-cluster" = "shared"
    "kubernetes.io/role/elb"                                        = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${var.prefix}-${var.environment}-cluster" = "shared"
    "kubernetes.io/role/internal-elb"                               = "1"
  }

  tags = {
    Terraform   = "true"
    Environment = var.environment
  }
}
