# Alerta de custo da conta inteira. É a rede de segurança contra esquecer a camada ephemeral ligada.

variable "budget_limit_usd" {
  description = "Limite mensal de custo, em dólares, a partir do qual os alertas são calculados."
  type        = number
  default     = 15

  validation {
    condition     = var.budget_limit_usd > 0
    error_message = "budget_limit_usd precisa ser maior que zero."
  }
}

variable "budget_alert_email" {
  description = "E-mail que recebe os alertas de custo. Defina no terraform.tfvars, que não é versionado."
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.budget_alert_email))
    error_message = "budget_alert_email precisa ser um e-mail válido."
  }
}

resource "aws_budgets_budget" "monthly" {
  name         = "accessflow-monthly"
  budget_type  = "COST"
  limit_amount = format("%.1f", var.budget_limit_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Gasto real: avisa em 50%, 80% e 100% do limite.
  dynamic "notification" {
    for_each = [50, 80, 100]

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_alert_email]
    }
  }

  # Previsão: avisa se o mês tende a passar do limite, antes de passar de fato.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}