# Convenções do Terraform

Valem para todo código novo em `infra/`. O desenho das camadas e a operação estão no [README.md](README.md).

## Versões

- Terraform `1.15.9` ([.terraform-version](.terraform-version)); em toda camada, `required_version = "~> 1.15"`.
- Provider AWS `~> 6.0` em toda camada.
- O `.terraform.lock.hcl` de cada camada é versionado. Só muda em atualização de versão feita de propósito.

## Arquivos de uma camada

Cada camada é um root module numa pasta própria.

| Arquivo | Conteúdo |
|---|---|
| `versions.tf` | `required_version` e `required_providers` |
| `providers.tf` | providers e `default_tags` |
| `backend.tf` | `backend "s3" {}` |
| `variables.tf` | variáveis |
| `locals.tf` | valores derivados, como o prefixo de nomes |
| `outputs.tf` | outputs |
| um por assunto | `network.tf`, `database.tf`, `ecs.tf` etc.: recursos e data sources do assunto |

Não há `main.tf`.

## Nomes

- Recursos novos na AWS: `accessflow-<ambiente>-<recurso>`, montado a partir de `local.name_prefix`.
- Nomes no Terraform (recursos, variáveis, outputs, locals) em `snake_case`.
- Nomes de arquivo em `kebab-case`.

## Tags

Definidas em `default_tags` no provider, nunca repetidas recurso a recurso:

| Tag | Valor |
|---|---|
| `Project` | `accessflow` |
| `Environment` | `var.environment` |
| `ManagedBy` | `terraform` |
| `Layer` | nome da camada |

## Variáveis e outputs

- Toda variável tem `description` e, quando fizer sentido, `validation`.
- Todo output tem `description`. O que for sensível leva `sensitive = true`.
- Nenhum valor fixo de conta (ID, ARN com ID, nome de bucket). Use data sources ou variáveis.
- A região vem de variável. O bloco `backend` não aceita variáveis: o que ele precisa vem do `backend.hcl`.

## Dados entre camadas

- Uma camada lê outra por `terraform_remote_state`. Nada de copiar ID ou ARN à mão de um output para uma variável.
- Só se leem camadas que sobem antes: `bootstrap` → `permanent` → `ephemeral`.
- Única exceção: o nome do bucket de state, informado no `backend.hcl` e no `terraform.tfvars`, porque é preciso
  conhecê-lo para chegar ao state.
- Quem lê o state de uma camada lê o state inteiro, segredos incluídos. Trate o acesso ao bucket como acesso a segredo.

## Camada `ephemeral`

Tudo precisa sair com um único `terraform destroy`:

- sem `deletion_protection`;
- sem `prevent_destroy`;
- sem snapshot final de banco;
- segredos com `recovery_window_in_days = 0`;
- o que precisa sobreviver ao `destroy` não pertence a esta camada.

## Segredos

- Nada de segredo em arquivo versionado, em variável ou em `*.tfvars`.
- Segredos ficam no Secrets Manager e chegam às aplicações por referência.
- `terraform.tfvars`, `backend.hcl`, state e planos salvos nunca são versionados ([.gitignore](.gitignore)).

## Código que já existia

Os recursos de `bootstrap` e `permanent` foram criados antes destas regras: os nomes não têm ambiente e as tags não
incluem `Environment`. Não renomeie nem retague recurso existente por convenção: renomear pode recriar o recurso, e
qualquer mudança dessas precisa de um `plan` revisado. Nas duas camadas, o `backend "s3"` continua dentro do
`versions.tf`.
