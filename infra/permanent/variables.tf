variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Servidor na Virginia"
}

variable "domain_prefix" {
  type    = string
  default = "Prefixo do dominio do login hospedado (unico por região na AWS)."
}

variable "web_callback_urls" {
  type    = list(string)
  default = ["http://localhost:3000/api/auth/callback"]
}

variable "web_logout_urls" {
  type    = list(string)
  default = ["http://localhost:3000"]
}

variable "enable_dev_cli_client" {
  type        = bool
  default     = true
  description = "Cria um App Client só para obter tokens via CLI em desenvolvimento."
}