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

variable "vpc_cidr" {
  description = "Faixa de IPs da VPC. As subnets são derivadas dela."
  type        = string
  default     = "10.20.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr precisa ser um bloco CIDR válido, por exemplo 10.20.0.0/16."
  }
}

variable "api_port" {
  description = "Porta em que a API escuta dentro do container."
  type        = number
  default     = 3333
}

variable "web_port" {
  description = "Porta em que o web (Next.js) escuta dentro do container."
  type        = number
  default     = 3000
}
