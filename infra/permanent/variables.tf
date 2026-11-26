variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "Região da AWS onde o Cognito é criado."
}

variable "domain_prefix" {
  description = "Prefixo do domínio do login hospedado (único por região na AWS)."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", var.domain_prefix))
    error_message = "Use só letras minúsculas, números e hífen (até 63 caracteres), sem hífen no início ou no fim."
  }

  validation {
    condition     = !can(regex("aws|amazon|cognito", var.domain_prefix))
    error_message = "O prefixo não pode conter 'aws', 'amazon' ou 'cognito'."
  }
}

variable "web_callback_urls" {
  type        = list(string)
  default     = ["http://localhost:3000/api/auth/callback"]
  description = "URLs para onde o login hospedado pode redirecionar o client web depois de autenticar."
}

variable "web_logout_urls" {
  type        = list(string)
  default     = ["http://localhost:3000"]
  description = "URLs para onde o login hospedado pode redirecionar o client web depois do logout."
}

variable "enable_dev_cli_client" {
  type        = bool
  default     = true
  description = "Cria um App Client só para obter tokens via CLI em desenvolvimento."
}