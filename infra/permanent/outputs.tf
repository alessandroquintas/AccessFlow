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
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}