terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.95.0, < 6.0.0"
    }
    # Add other providers as needed
  }
}

provider "aws" {
  region = var.aws_region
}