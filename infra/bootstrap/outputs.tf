output "state_bucket" {
  description = "Nome do bucket S3 que guarda o state de todas as camadas."
  value       = aws_s3_bucket.tfstate.bucket
}
