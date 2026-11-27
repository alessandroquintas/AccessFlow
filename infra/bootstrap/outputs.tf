output "state_bucket" {
  description = "Nome do bucket S3 que guarda o state de todas as camadas."
  value       = aws_s3_bucket.tfstate.bucket
}

output "ci_plan_role_arn" {
  description = "ARN da role assumida pelos workflows para o terraform plan."
  value       = aws_iam_role.ci_plan.arn
}

output "ci_deploy_role_arn" {
  description = "ARN da role assumida pelo workflow de deploy (Environment production)."
  value       = aws_iam_role.ci_deploy.arn
}
