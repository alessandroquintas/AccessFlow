# VPC, subnets, rotas e security groups.

# Rede da aplicação: VPC em duas zonas, subnets públicas (ALB e tasks) e privadas (banco),
# sem NAT Gateway. As tasks saem para a internet pelo próprio IP público.

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${local.name_prefix}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${local.name_prefix}-igw" }
}

# ---------- Subnets ----------

# Públicas: 10.20.0.0/24 e 10.20.1.0/24. O IP público é dado pelo ECS, não pela subnet.
resource "aws_subnet" "public" {
  count = length(local.azs)

  vpc_id                  = aws_vpc.main.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  map_public_ip_on_launch = false

  tags = { Name = "${local.name_prefix}-public-${local.azs[count.index]}" }
}

# Privadas: 10.20.10.0/24 e 10.20.11.0/24. Sem rota para a internet.
resource "aws_subnet" "private" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)

  tags = { Name = "${local.name_prefix}-private-${local.azs[count.index]}" }
}

# ---------- Rotas ----------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${local.name_prefix}-public" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Sem rota 0.0.0.0/0: o que está nas subnets privadas não fala com a internet.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${local.name_prefix}-private" }
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Endpoint gratuito para o S3 (as camadas das imagens do ECR ficam no S3).
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.public.id, aws_route_table.private.id]

  tags = { Name = "${local.name_prefix}-s3" }
}

# ---------- Security groups ----------
# Cadeia: CloudFront → ALB → web e API → banco. Cada um só aceita quem vem do anterior.

# Faixas de IP que o CloudFront usa para falar com a origem (mantida pela AWS).
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb"
  description = "ALB: aceita só o CloudFront."
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name_prefix}-alb" }
}

resource "aws_security_group" "api" {
  name        = "${local.name_prefix}-api"
  description = "Tasks da API e da migração."
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name_prefix}-api" }
}

resource "aws_security_group" "web" {
  name        = "${local.name_prefix}-web"
  description = "Tasks do web (Next.js)."
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name_prefix}-web" }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds"
  description = "Banco: aceita só a API e a migração."
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name_prefix}-rds" }
}

# ALB: entra HTTP só do CloudFront; sai só para o web e a API.
resource "aws_vpc_security_group_ingress_rule" "alb_from_cloudfront" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP vindo do CloudFront."
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_to_web" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Encaminha para o web."
  referenced_security_group_id = aws_security_group.web.id
  ip_protocol                  = "tcp"
  from_port                    = var.web_port
  to_port                      = var.web_port
}

resource "aws_vpc_security_group_egress_rule" "alb_to_api" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Encaminha /v1/* para a API."
  referenced_security_group_id = aws_security_group.api.id
  ip_protocol                  = "tcp"
  from_port                    = var.api_port
  to_port                      = var.api_port
}

# API: entra do ALB (/v1/*) e do web (GraphQL por dentro da VPC).
resource "aws_vpc_security_group_ingress_rule" "api_from_alb" {
  security_group_id            = aws_security_group.api.id
  description                  = "Rotas /v1/* vindas do ALB."
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = var.api_port
  to_port                      = var.api_port
}

resource "aws_vpc_security_group_ingress_rule" "api_from_web" {
  security_group_id            = aws_security_group.api.id
  description                  = "GraphQL vindo do web, por dentro da VPC."
  referenced_security_group_id = aws_security_group.web.id
  ip_protocol                  = "tcp"
  from_port                    = var.api_port
  to_port                      = var.api_port
}

# A API sai para o banco e para a internet (Cognito, ECR, Secrets Manager, CloudWatch).
resource "aws_vpc_security_group_egress_rule" "api_all" {
  security_group_id = aws_security_group.api.id
  description       = "Saída para o banco e para os serviços da AWS."
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# Web: entra só do ALB.
resource "aws_vpc_security_group_ingress_rule" "web_from_alb" {
  security_group_id            = aws_security_group.web.id
  description                  = "Tráfego vindo do ALB."
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = var.web_port
  to_port                      = var.web_port
}

# O web sai para a API e para a internet (Cognito, ECR, Secrets Manager, CloudWatch).
resource "aws_vpc_security_group_egress_rule" "web_all" {
  security_group_id = aws_security_group.web.id
  description       = "Saída para a API e para os serviços da AWS."
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# Banco: entra só da API (e da migração, que usa o mesmo security group). Sem regra de saída.
resource "aws_vpc_security_group_ingress_rule" "rds_from_api" {
  security_group_id            = aws_security_group.rds.id
  description                  = "PostgreSQL vindo da API e da migração."
  referenced_security_group_id = aws_security_group.api.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}