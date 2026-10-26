locals {
  hosted_ui_domain = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "issuer" {
  value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "web_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "dev_cli_client_id" {
  value = one(aws_cognito_user_pool_client.dev_cli[*].id)
}

output "hosted_ui_domain" {
  value = local.hosted_ui_domain
}

output "integration_client_id" {
  value = aws_cognito_user_pool_client.integration_demo.id
}

output "integration_client_secret" {
  value     = aws_cognito_user_pool_client.integration_demo.client_secret
  sensitive = true
}

output "token_endpoint" {
  value = "${local.hosted_ui_domain}/oauth2/token"
}
