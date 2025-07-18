# Gemini CLI Project Documentation

This file will be used to store explanations and documentation generated during our chat sessions.

---

## Terraform Modules Explained

### What are Modules Used For?

Think of a Terraform module as a reusable, self-contained package of Terraform code. In programming, you create functions to avoid repeating code and to organize your logic. In Terraform, you use modules for the exact same reasons.

The main goals of using modules are:

1.  **Organization:** They help you structure your code logically. Instead of having one giant file with hundreds of resources, you can group related resources into a module (e.g., all networking resources in a `network` module, all EKS resources in an `eks` module).
2.  **Reusability:** You can write a module once and use it many times, both within the same project and across different projects. For example, you could use the same VPC module to create networking for your development, staging, and production environments.
3.  **Encapsulation:** A module hides the complexity of the resources it creates. You only need to know what inputs (`variables`) it requires and what outputs it produces. You don't need to worry about the internal details of how it works.
4.  **Consistency:** By using modules, you ensure that you are creating resources in a consistent and standardized way every time.

---

### 1. Local Modules

This is the first type of module you've asked about and one that is used in your project.

**What "Local" Means:**
A "local" module is simply a module whose source code is located in a subdirectory on your local filesystem relative to the main configuration files. Terraform does not need to download it from an external source.

**In Your Project:**
Your project uses a local module for OIDC configuration.

-   **File:** `/home/geek/2025-DevOps-Projects/CI-CD-Projects/NotHarshhaa-DevOps-Projects/DevOps-Projects/DevOps-Project-36/3-tier-app-eks/infra/oidc.tf`
-   **Code:**
    ```terraform
    module "oidc" {
      source = "./modules/oidc" // This path makes it a local module

      role_name   = "GitHubActionsEKSDeployRole"
      policy_name = "GitHubActionsEKSPolicy"
      # ... other variables
    }
    ```
-   **Explanation:** The `source = "./modules/oidc"` tells Terraform to look in the `modules/oidc` subdirectory for the Terraform files that define this module. This is a great use case for a local module because the OIDC setup is specific to this project's CI/CD process but complex enough that it benefits from being encapsulated in its own set of files (`main.tf`, `variables.tf`, `output.tf` inside `modules/oidc/`).

---

### 2. Other Types of Modules (Apart from Local)

Besides local modules, you can source modules from several other locations. Your project heavily uses the most common external source: the **Public Terraform Registry**.

#### A. Public Terraform Registry

This is a public repository of modules shared by HashiCorp, cloud providers, and the community. It's the easiest way to use high-quality, pre-built infrastructure components.

**In Your Project:**
Your project uses two very popular public modules.

1.  **VPC Module:**
    -   **File:** `/home/geek/2025-DevOps-Projects/CI-CD-Projects/NotHarshhaa-DevOps-Projects/DevOps-Projects/DevOps-Project-36/3-tier-app-eks/infra/network.tf`
    -   **Code:**
        ```terraform
        module "eks_network" {
          source  = "terraform-aws-modules/vpc/aws"
          version = "5.9.0" // (Example version, your file doesn't specify one but it's best practice)

          name = "${var.prefix}-${var.environment}-vpc"
          # ... other variables
        }
        ```
    -   **Explanation:** The `source = "terraform-aws-modules/vpc/aws"` tells Terraform to download and use the official AWS VPC module from the public registry. This saves you from having to write all the complex code for VPCs, subnets, route tables, and NAT gateways yourself.

2.  **EKS Module:**
    -   **File:** `/home/geek/2025-DevOps-Projects/CI-CD-Projects/NotHarshhaa-DevOps-Projects/DevOps-Projects/DevOps-Project-36/3-tier-app-eks/infra/eks.tf`
    -   **Code:**
        ```terraform
        module "eks" {
          source  = "terraform-aws-modules/eks/aws"
          version = "20.33.1"

          cluster_name = "${var.prefix}-${var.environment}-cluster"
          # ... other variables
        }
        ```
    -   **Explanation:** Similarly, this uses the official AWS EKS module to provision the entire EKS cluster, including node groups and add-ons.

#### B. Git Repositories

You can source modules directly from any Git repository (like GitHub, GitLab, or Bitbucket). This is very useful for sharing modules within your organization without publishing them publicly.

-   **Example (Not in your project, but for illustration):**
    Imagine your company has a standard module for creating S3 buckets with specific security policies. You could store it in a private GitHub repo and use it like this:
    ```terraform
    module "secure_bucket" {
      source = "git::https://github.com/your-company/terraform-modules.git//aws/s3-bucket?ref=v1.2.0"

      bucket_name = "my-app-data"
      # ... other variables
    }
    ```
    -   `git::` is the prefix.
    -   `//` separates the repository URL from a subdirectory within that repo.
    -   `?ref=` pins the module to a specific Git branch, tag, or commit hash for stability.

#### C. Private Terraform Registry

For larger organizations, Terraform Cloud and Terraform Enterprise provide a private registry. This is the most robust way to manage and share modules internally, with features like versioning, access control, and a searchable index.

-   **Example (Not in your project):**
    ```terraform
    module "app_service_networking" {
      source = "app.terraform.io/your-company/networking/aws"
      version = "2.1.0"

      # ... other variables
    }
    ```
    -   The source address points to your organization's private registry on Terraform Cloud/Enterprise.

---

## The `aws-oidc-github-cli` Directory Explained

### Purpose and Relation to the Project

The `aws-oidc-github-cli` directory contains a set of scripts and configuration files designed to **manually** set up the OpenID Connect (OIDC) trust relationship between AWS and GitHub Actions.

The primary goal of this setup is to enable a secure, password-less CI/CD pipeline. Instead of storing long-lived AWS access keys and secret keys as secrets in GitHub, the GitHub Actions runner can temporarily assume an IAM Role in AWS that grants it just the permissions it needs to deploy the application.

While the Terraform code in `oidc.tf` and the `modules/oidc/` directory automates this setup as part of the infrastructure-as-code, this `aws-oidc-github-cli` directory provides an alternative, manual way to achieve the same result using the AWS CLI. It is useful for:

*   **Understanding:** Seeing the raw AWS CLI commands helps you understand the underlying resources that Terraform is creating.
*   **Testing:** You can use the script to quickly test the OIDC connection without running a full `terraform apply`.
*   **Troubleshooting:** If the Terraform automation fails, you can use these scripts and policies as a reference to debug the issue.

### File Breakdown

1.  **`configure-oidc-github.sh`**
    *   **What it does:** This is the main shell script that executes the AWS CLI commands to build the OIDC infrastructure.
    *   **Steps:**
        1.  It creates the OIDC provider in IAM, telling AWS to trust identity tokens from `token.actions.githubusercontent.com`.
        2.  It creates the `GitHubActionsEKSDeployRole` IAM role, attaching the `trust-policy.json` to it.
        3.  It creates the `GitHubActionsEKSPolicy` IAM policy from the `eks-policy.json` file.
        4.  It attaches the policy to the role, granting the necessary permissions.

2.  **`trust-policy.json`**
    *   **What it does:** This is an IAM trust policy document. It defines **who** is allowed to assume the role.
    *   **Key Logic:** It specifies that the principal (the entity that can assume the role) must be a `Federated` user coming from the OIDC provider. Crucially, the `Condition` block ensures that only GitHub Actions running in the specified repository (`repo:$GITHUB_ORG/$GITHUB_REPO:*`) can assume this role.

3.  **`eks-policy.json`**
    *   **What it does:** This is an IAM permissions policy. It defines **what** actions the role is allowed to perform once it has been assumed.
    *   **Permissions Granted:**
        *   `eks:DescribeCluster`, `eks:ListClusters`: Allows the role to get information about the EKS cluster, which is needed by `kubectl`.
        *   `ecr:*`: A broad set of permissions for the Elastic Container Registry (ECR). This allows the CI/CD pipeline to push new Docker images to ECR.

4.  **`rbac.yaml`**
    *   **What it does:** This file is currently empty, but it serves as a critical placeholder.
    *   **Purpose:** While the IAM role grants permissions to interact with AWS APIs (like ECR and EKS), it does **not** grant permissions *inside* the Kubernetes cluster itself. To allow the GitHub Actions runner to deploy applications (e.g., create Deployments, Services, etc.), you would need to create a Kubernetes `Role` or `ClusterRole` and a `RoleBinding` or `ClusterRoleBinding`. This file is where that Kubernetes RBAC (Role-Based Access Control) configuration would go.

---

## OIDC Explained: Securely Connecting GitHub to AWS

### What is OIDC?

**OpenID Connect (OIDC)** is an open standard for authentication. It allows applications to verify the identity of a user or service based on authentication performed by an **Identity Provider (IdP)**. Think of it like "Login with Google" or "Login with Facebook," but for applications and services.

In simple terms, OIDC provides a standardized way for one system (like GitHub) to prove its identity to another system (like AWS) and receive a secure token (called a JSON Web Token or JWT) as proof. The second system can then verify this token and grant access without ever needing a password or a permanent secret key.

### How Are We Using OIDC in This Project?

We are using OIDC to solve a major security challenge in CI/CD: **How do we give our GitHub Actions workflow permission to access our AWS account without storing permanent AWS access keys in GitHub?**

**The Old, Insecure Way:**

1.  Create an IAM User in AWS.
2.  Generate a permanent `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
3.  Copy these keys and save them as repository secrets in GitHub.
4.  The GitHub Actions workflow uses these secrets to authenticate to AWS.

*   **Problem:** These keys are powerful and long-lived. If they are ever leaked, an attacker has permanent access to your AWS account.

**The New, Secure OIDC Way (What This Project Does):**

1.  We establish a trust relationship between our AWS account and the GitHub OIDC Provider.
2.  The GitHub Actions workflow requests a temporary, short-lived OIDC token from GitHub.
3.  The workflow presents this token to AWS and asks to assume a specific IAM Role.
4.  AWS verifies the token is valid and comes from the correct GitHub repository.
5.  AWS grants the workflow temporary, short-lived security credentials.
6.  The workflow uses these temporary credentials to deploy the application to EKS and push images to ECR.

*   **Benefit:** No permanent secrets are ever stored in GitHub. The credentials expire automatically, dramatically reducing the risk if they are ever exposed.

### Code Explanation

The entire OIDC setup is automated by our Terraform code, specifically in the `oidc` module.

**1. Establishing Trust (`modules/oidc/main.tf`)**

First, we tell AWS to trust GitHub as an Identity Provider. This is the foundational step.

```terraform
# modules/oidc/main.tf

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1"
  ]
}
```

*   `url`: This is the unique URL for GitHub's OIDC provider.
*   `client_id_list`: Specifies that AWS's own Security Token Service (STS) is a valid audience for tokens from this provider.
*   `thumbprint_list`: A security measure to verify the provider's SSL certificate.

**2. Defining the Role and Trust Conditions (`modules/oidc/main.tf`)**

Next, we create the IAM Role that GitHub Actions will be allowed to assume. The most important part is the `assume_role_policy`.

```terraform
# modules/oidc/main.tf

resource "aws_iam_role" "github_actions_role" {
  name = var.role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          # This says the role can be assumed by a federated user from our OIDC provider
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            # This is the critical security check!
            "token.actions.githubusercontent.com:sub" = [
              for repo in var.github_repositories :
              "repo:${repo.org}/${repo.repo}:${repo.branch}"
            ]
          }
        }
      }
    ]
  })
}
```

*   `Principal.Federated`: This specifies that the entity assuming the role will authenticate via the OIDC provider we created above.
*   `Action`: `sts:AssumeRoleWithWebIdentity` is the specific API call used for OIDC-based role assumption.
*   `Condition`: This is the most important security control. It locks down who can assume the role. The `...:sub` field in the OIDC token contains information about the source repository. This condition ensures that **only** workflows running in the repositories defined in your `github_repositories` variable (e.g., `akhileshmishrabiz/DevOpsDojo`) can assume this role.

**3. Attaching Permissions (`oidc.tf` and `modules/oidc/main.tf`)**

Finally, we define what the role can *do* after it's been assumed by attaching the permissions policy.

```terraform
# oidc.tf

module "oidc" {
  source = "./modules/oidc"

  # ... other variables
  policy_json = local.eks_ecr_policy_json # This passes the EKS/ECR permissions
}
```

This setup provides a secure, modern, and automated way to handle credentials for CI/CD, forming the backbone of this project's deployment strategy.

---

## Terraform-Execution steps

You should run `terraform init`, `plan`, and `apply` from the main `infra` folder, not from within the `modules` subdirectories.

### Reason

The `infra` directory is the **root module** of your Terraform configuration. The `.tf` files within this directory (like `eks.tf`, `rds.tf`, etc.) define the overall infrastructure and call the reusable **child modules** located in the `infra/modules` directory.

Here is the step-by-step process and reasoning:

1.  **`cd /home/geek/2025-DevOps-Projects/CI-CD-Projects/NotHarshhaa-DevOps-Projects/DevOps-Projects/DevOps-Project-36/3-tier-app-eks/infra`**: Navigate to your root module directory.

2.  **`terraform init`**:
    *   **Why here?** When you run `init` from the root module, Terraform automatically discovers the `module` blocks in your configuration (e.g., `module "eks_network"`, `module "oidc"`).
    *   **What it does:** It downloads the necessary provider plugins (like the AWS provider) and also finds and loads the source code for the child modules from the specified local path (`./modules/network`, `./modules/oidc`). It essentially assembles your entire configuration from the root and its children.

3.  **`terraform plan` & `terraform apply`**:
    *   **Why here?** These commands operate on the entire configuration that was initialized. Running them from the `infra` directory ensures that Terraform evaluates all your `.tf` files and the modules they call, creating a single, unified execution plan.
    *   **What happens if you run them in a module?** If you were to run `terraform apply` inside `infra/modules/network`, it would fail. The module is not a complete configuration; it likely depends on variables passed down from the root module and doesn't have its own backend or provider configuration. Modules are designed to be reusable components, not standalone deployments.

In short, you always execute Terraform commands from the root directory of your configuration, which then manages and orchestrates the child modules as needed.