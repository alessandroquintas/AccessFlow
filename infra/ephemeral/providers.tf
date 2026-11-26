provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "accessflow"
      Environment = var.environment
      ManagedBy   = "terraform"
      Layer       = "ephemeral"
    }
  }
}
