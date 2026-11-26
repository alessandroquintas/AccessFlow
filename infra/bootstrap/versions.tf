terraform {
  required_version = "~> 1.15"

  # O state do bootstrap fica no próprio bucket que ele cria. No primeiro
  # apply este bloco não existia; o state foi migrado depois com
  # `terraform init -migrate-state -backend-config=backend.hcl`.
  # O nome do bucket vem do backend.hcl (fora do Git).
  backend "s3" {
    key          = "bootstrap/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}
