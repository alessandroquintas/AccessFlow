# RDS PostgreSQL, subnet group e parameter group.

# Banco da aplicação. Fica nas subnets privadas e só aceita a API (security group rds).
# Camada efêmera: sem proteção contra exclusão, sem snapshot final e sem backups automáticos.

resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db"
  description = "Subnets privadas do banco."
  subnet_ids  = aws_subnet.private[*].id

  tags = { Name = "${local.name_prefix}-db" }
}

# Obriga toda conexão a usar TLS.
resource "aws_db_parameter_group" "postgres" {
  name        = "${local.name_prefix}-postgres17"
  family      = "postgres17"
  description = "PostgreSQL 17 com TLS obrigatório."

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

# Senha só com letras e números: entra na DATABASE_URL sem precisar de escape.
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_instance" "main" {
  identifier     = "${local.name_prefix}-db"
  engine         = "postgres"
  engine_version = "17"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 0
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "accessflow"
  username = "accessflow"
  password = random_password.db.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name
  publicly_accessible    = false
  multi_az               = false

  # Teste curto: sem backup automático e destrutível com um terraform destroy.
  backup_retention_period  = 0
  deletion_protection      = false
  skip_final_snapshot      = true
  delete_automated_backups = true

  apply_immediately            = true
  auto_minor_version_upgrade   = true
  performance_insights_enabled = false

  tags = { Name = "${local.name_prefix}-db" }
}