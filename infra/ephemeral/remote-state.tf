# Fica neste arquivo, junto do único uso: o bucket do state da camada permanent.
variable "state_bucket" {
  type        = string
  description = "Nome do bucket S3 de state (output state_bucket do bootstrap)."

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.state_bucket))
    error_message = "Informe um nome de bucket S3 válido."
  }
}

data "terraform_remote_state" "permanent" {
  backend = "s3"

  config = {
    bucket = var.state_bucket
    key    = "permanent/terraform.tfstate"
    region = var.aws_region
  }
}
