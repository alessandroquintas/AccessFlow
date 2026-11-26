variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Região da AWS da camada efêmera e do bucket de state."
}

variable "environment" {
  type        = string
  default     = "prod"
  description = "Ambiente; entra no nome dos recursos e na tag Environment."

  validation {
    condition     = can(regex("^[a-z][a-z0-9]{1,9}$", var.environment))
    error_message = "Use de 2 a 10 letras minúsculas ou dígitos, começando por letra."
  }
}
