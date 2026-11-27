locals {
  hosted_ui_domain = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "user_pool_id" {
  description = "ID do user pool do Cognito."
  value       = aws_cognito_user_pool.main.id
}

output "issuer" {
  description = "Emissor (iss) dos tokens do user pool."
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "web_client_id" {
  description = "ID do app client público do front-end."
  value       = aws_cognito_user_pool_client.web.id
}

output "dev_cli_client_id" {
  description = "ID do app client de desenvolvimento para a AWS CLI; nulo quando desligado."
  value       = one(aws_cognito_user_pool_client.dev_cli[*].id)
}

output "hosted_ui_domain" {
  description = "URL base do login hospedado do Cognito."
  value       = local.hosted_ui_domain
}

output "integration_client_id" {
  description = "ID do app client de máquina de demonstração."
  value       = aws_cognito_user_pool_client.integration_demo.id
}

output "integration_client_secret" {
  description = "Segredo do app client de máquina de demonstração."
  value       = aws_cognito_user_pool_client.integration_demo.client_secret
  sensitive   = true
}

output "token_endpoint" {
  description = "Endpoint OAuth2 onde as integrações obtêm tokens."
  value       = "${local.hosted_ui_domain}/oauth2/token"
}

output "ecr_repository_urls" {
  description = "URL de cada repositório do ECR, usada no docker push e nas task definitions."
  value       = { for name, repo in aws_ecr_repository.app : name => repo.repository_url }
}

output "user_pool_arn" {
  description = "ARN do user pool, usado para restringir as permissões da task role da API."
  value       = aws_cognito_user_pool.main.arn
}
