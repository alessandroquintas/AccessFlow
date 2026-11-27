# Segredos no Secrets Manager.
# Segredos da aplicação no Secrets Manager. As tasks do ECS recebem esses valores como
# variáveis de ambiente, sem que eles apareçam na task definition.
#
# recovery_window_in_days = 0: apaga na hora no destroy, para o mesmo nome poder ser
# recriado no próximo deploy (senão o nome fica reservado por até 30 dias).
#
# Atenção: a senha do banco e o segredo da sessão ficam também no state do Terraform,
# que está no bucket privado, criptografado e versionado.

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name_prefix}/database-url"
  description             = "URL de conexão da API com o PostgreSQL (com TLS)."
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = format(
    "postgresql://%s:%s@%s:%d/%s?schema=public&sslmode=require",
    aws_db_instance.main.username,
    random_password.db.result,
    aws_db_instance.main.address,
    aws_db_instance.main.port,
    aws_db_instance.main.db_name,
  )
}

# Chave que o web usa para criptografar o cookie de sessão.
resource "random_password" "web_session" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "web_session" {
  name                    = "${local.name_prefix}/web-session-secret"
  description             = "Chave de criptografia do cookie de sessão do web."
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "web_session" {
  secret_id     = aws_secretsmanager_secret.web_session.id
  secret_string = random_password.web_session.result
}