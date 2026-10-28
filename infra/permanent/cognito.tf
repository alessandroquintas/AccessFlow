resource "aws_cognito_user_pool" "main" {
  name = "accessflow-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 3
  }

  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  deletion_protection = "ACTIVE"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.main.id
}

# Cliente do front-end: público, Authorization Code + PKCE, sem secret.
resource "aws_cognito_user_pool_client" "web" {
  name         = "accessflow-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile", "aws.cognito.signin.user.admin"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = var.web_callback_urls
  logout_urls                          = var.web_logout_urls

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

# Cliente só de desenvolvimento: permite obter token pela AWS CLI,
# sem precisar do front-end. Desligar em produção.
resource "aws_cognito_user_pool_client" "dev_cli" {
  count = var.enable_dev_cli_client ? 1 : 0

  name         = "accessflow-dev-cli"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret     = false
  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  access_token_validity         = 60

  token_validity_units {
    access_token = "minutes"
  }
}

# Resource server da API: define os escopos que clients de máquina podem pedir.
resource "aws_cognito_resource_server" "api" {
  identifier   = "accessflow-api"
  name         = "AccessFlow API"
  user_pool_id = aws_cognito_user_pool.main.id

  scope {
    scope_name        = "members.read"
    scope_description = "Consultar se um usuário é membro de uma organização"
  }

  scope {
    scope_name        = "authorize"
    scope_description = "Perguntar se um usuário pode executar ações numa organização"
  }
}

# Cliente de integração (máquina): client credentials, com secret e sem usuário.
resource "aws_cognito_user_pool_client" "integration_demo" {
  name         = "accessflow-integration-demo"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = true

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["client_credentials"]
  # Escopo explícito, e não scope_identifiers inteiro: um escopo novo no
  # resource server não deve ser concedido a este client automaticamente.
  allowed_oauth_scopes = [
    "${aws_cognito_resource_server.api.identifier}/members.read",
    "${aws_cognito_resource_server.api.identifier}/authorize",
  ]

  # Sem esta lista o Cognito habilita SRP e CUSTOM_AUTH por padrão. O client
  # credentials não emite refresh token, então o fluxo abaixo fica inerte.
  explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH"]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  access_token_validity         = 60

  token_validity_units {
    access_token = "minutes"
  }
}