# Roles assumidas pelos workflows do GitHub Actions.

locals {
  state_bucket_arn = aws_s3_bucket.tfstate.arn
  account_id       = data.aws_caller_identity.current.account_id
}

# ---------- Role de plan (só leitura) ----------

resource "aws_iam_role" "ci_plan" {
  name                 = "accessflow-ci-plan"
  description          = "Terraform plan nos pull requests e na main (somente leitura)."
  assume_role_policy   = data.aws_iam_policy_document.ci_plan_trust.json
  max_session_duration = 3600
}

# Leitura de tudo, para o plan conseguir comparar o código com a conta.
resource "aws_iam_role_policy_attachment" "ci_plan_read_only" {
  role       = aws_iam_role.ci_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# O plan também grava e apaga o arquivo de lock do state (use_lockfile).
data "aws_iam_policy_document" "ci_plan_state_lock" {
  statement {
    sid       = "ManageStateLockFiles"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${local.state_bucket_arn}/*.tflock"]
  }
}

resource "aws_iam_role_policy" "ci_plan_state_lock" {
  name   = "state-lock"
  role   = aws_iam_role.ci_plan.id
  policy = data.aws_iam_policy_document.ci_plan_state_lock.json
}

# ---------- Role de deploy (camada ephemeral e ECR) ----------

resource "aws_iam_role" "ci_deploy" {
  name                 = "accessflow-ci-deploy"
  description          = "Deploy e destroy da camada ephemeral e push de imagens no ECR."
  assume_role_policy   = data.aws_iam_policy_document.ci_deploy_trust.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "ci_deploy" {
  # State: lê o permanent (para o remote_state) e escreve só o do ephemeral.
  statement {
    sid       = "ListStateBucket"
    actions   = ["s3:ListBucket"]
    resources = [local.state_bucket_arn]
  }

  statement {
    sid       = "ReadPermanentState"
    actions   = ["s3:GetObject"]
    resources = ["${local.state_bucket_arn}/permanent/*"]
  }

  statement {
    sid       = "ManageEphemeralState"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${local.state_bucket_arn}/ephemeral/*"]
  }

  # ECR: o login vale para a conta; o push, só nos repositórios do projeto.
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = ["arn:aws:ecr:${var.aws_region}:${local.account_id}:repository/accessflow-*"]
  }

  # Serviços que a camada ephemeral cria e destrói. Por enquanto, amplo por serviço:
  # será restringido na Fase 14, quando a camada existir e soubermos as ações exatas.
  statement {
    sid = "ManageEphemeralServices"
    actions = [
      "ec2:*",
      "elasticloadbalancing:*",
      "ecs:*",
      "rds:*",
      "logs:*",
      "cloudfront:*",
      "servicediscovery:*",
    ]
    resources = ["*"]
  }

  # Segredos: só os do projeto.
  statement {
    sid       = "ManageProjectSecrets"
    actions   = ["secretsmanager:*"]
    resources = ["arn:aws:secretsmanager:${var.aws_region}:${local.account_id}:secret:accessflow-*"]
  }

  statement {
    sid       = "GenerateRandomPassword"
    actions   = ["secretsmanager:GetRandomPassword"]
    resources = ["*"]
  }

  # Client web do ambiente, criado no pool do Cognito.
  statement {
    sid = "ManageCognitoAppClients"
    actions = [
      "cognito-idp:CreateUserPoolClient",
      "cognito-idp:DeleteUserPoolClient",
      "cognito-idp:DescribeUserPoolClient",
      "cognito-idp:UpdateUserPoolClient",
      "cognito-idp:DescribeUserPool",
    ]
    resources = ["arn:aws:cognito-idp:${var.aws_region}:${local.account_id}:userpool/*"]
  }

  # IAM: só roles com o prefixo do ambiente (as roles das tasks do ECS).
  statement {
    sid = "ManageEphemeralRoles"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:UpdateRole",
      "iam:PutRolePolicy",
      "iam:GetRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:ListInstanceProfilesForRole",
    ]
    resources = ["arn:aws:iam::${local.account_id}:role/accessflow-prod-*"]
  }

  # Passar essas roles só para o ECS.
  statement {
    sid       = "PassEphemeralRolesToEcs"
    actions   = ["iam:PassRole"]
    resources = ["arn:aws:iam::${local.account_id}:role/accessflow-prod-*"]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "ci_deploy" {
  name   = "deploy-ephemeral"
  role   = aws_iam_role.ci_deploy.id
  policy = data.aws_iam_policy_document.ci_deploy.json
}