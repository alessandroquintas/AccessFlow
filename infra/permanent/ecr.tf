# Repositórios das imagens Docker da aplicação.

locals {
  ecr_repositories = toset(["accessflow-api", "accessflow-web"])
}

resource "aws_ecr_repository" "app" {
  for_each = local.ecr_repositories

  name = each.value

  # Tag imutável: uma tag (o SHA do commit) aponta sempre para a mesma imagem.
  image_tag_mutability = "IMMUTABLE"

  # Permite apagar o repositório mesmo com imagens dentro.
  force_delete = true

  # Procura vulnerabilidades conhecidas a cada push (a varredura básica é gratuita).
  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  for_each = aws_ecr_repository.app

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Remove imagens sem tag depois de 1 dia."
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Mantém só as 5 imagens mais recentes."
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = { type = "expire" }
      },
    ]
  })
}