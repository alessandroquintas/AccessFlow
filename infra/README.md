# Infraestrutura do AccessFlow

Terraform com um root module por ciclo de vida. O state fica em S3, com lock nativo (`use_lockfile`).

Antes de escrever código novo, leia o [CONVENTIONS.md](CONVENTIONS.md).

## Camadas

```
infra/
  bootstrap/   bucket de state   (depois: OIDC do GitHub, roles de CI e orçamento)       permanente
  permanent/   Cognito           (depois: ECR)                                           permanente
  ephemeral/   só a estrutura    (depois: rede, RDS, segredos, ALB, CloudFront, ECS)     sobe e desce inteira
```

| Camada | Ciclo de vida | Chave do state |
|---|---|---|
| `bootstrap` | permanente | `bootstrap/terraform.tfstate` |
| `permanent` | permanente | `permanent/terraform.tfstate` |
| `ephemeral` | efêmera | `ephemeral/terraform.tfstate` |

A `ephemeral` lê a `permanent` por `terraform_remote_state`.

## Nunca destruir

- **O bucket de state** (`bootstrap`): guarda o state de todas as camadas, inclusive o dele.
- **O user pool do Cognito** (`permanent`): destruí-lo apaga os usuários, e eles não voltam com um novo `apply`.

Os dois têm `prevent_destroy`, e o user pool tem também `deletion_protection`. Não remova essas proteções. Não rode
`terraform destroy` em `bootstrap` nem em `permanent`.

## Pré-requisitos

- Terraform na versão do [.terraform-version](.terraform-version).
- Credenciais da AWS no ambiente.

## Ordem de execução

`bootstrap` → `permanent` → `ephemeral`. Os comandos abaixo partem da pasta `infra/`.

Cada camada precisa de um `backend.hcl` local (não versionado). Em `permanent` e `ephemeral` há também o
`terraform.tfvars`.

### 1. bootstrap

O `backend.hcl` desta camada só precisa do nome do bucket; o restante está no `versions.tf`:

```hcl
bucket = "accessflow-tfstate-SEU_ACCOUNT_ID"
```

```sh
terraform -chdir=bootstrap init -backend-config=backend.hcl
terraform -chdir=bootstrap plan
```

**Só na primeira vez de uma conta nova**, quando o bucket ainda não existe: comente o bloco `backend "s3"` no
`versions.tf`, rode `init` e `apply` com state local, restaure o bloco e migre o state:

```sh
terraform -chdir=bootstrap init -migrate-state -backend-config=backend.hcl
```

### 2. permanent

```sh
cp permanent/backend.hcl.example permanent/backend.hcl
cp permanent/terraform.tfvars.example permanent/terraform.tfvars
# preencha os dois arquivos
terraform -chdir=permanent init -backend-config=backend.hcl
terraform -chdir=permanent plan
terraform -chdir=permanent apply
```

Os `cp` valem para a primeira configuração: eles sobrescrevem arquivos que já existam.

### 3. ephemeral

```sh
cp ephemeral/backend.hcl.example ephemeral/backend.hcl
cp ephemeral/terraform.tfvars.example ephemeral/terraform.tfvars
# preencha os dois arquivos
terraform -chdir=ephemeral init -backend-config=backend.hcl
```

A variável `state_bucket` é o output `state_bucket` do bootstrap. A `aws_region` precisa ser a região do bucket.

## Subir e derrubar a ephemeral

Subir:

```sh
terraform -chdir=ephemeral plan
terraform -chdir=ephemeral apply
```

Derrubar (apaga tudo da camada, **inclusive os dados do banco**, quando ele existir):

```sh
terraform -chdir=ephemeral plan -destroy
terraform -chdir=ephemeral destroy
```

Hoje a camada não tem recursos: ela só lê o state da `permanent`.

## Validar sem acessar a AWS

Numa cópia de trabalho ainda não inicializada:

```sh
terraform fmt -check -recursive
terraform -chdir=<camada> init -backend=false
terraform -chdir=<camada> validate
```

Numa pasta já inicializada com o backend, o `init -backend=false` ainda pode ler o state no S3. Para ficar offline, use
um diretório de dados separado nos dois comandos:

```sh
TF_DATA_DIR=/tmp/tf-<camada> terraform -chdir=<camada> init -backend=false
TF_DATA_DIR=/tmp/tf-<camada> terraform -chdir=<camada> validate
```
