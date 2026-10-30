-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationClientStatus" ADD VALUE 'PROVISIONING';
ALTER TYPE "IntegrationClientStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "integration_clients" ADD COLUMN     "created_by_user_id" UUID,
ADD COLUMN     "revoked_at" TIMESTAMPTZ(3),
ADD COLUMN     "revoked_by_user_id" UUID,
ADD COLUMN     "scopes" TEXT[],
ALTER COLUMN "client_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "integration_clients" ADD CONSTRAINT "integration_clients_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_clients" ADD CONSTRAINT "integration_clients_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Escrito à mão: dados existentes e CHECK (o Prisma não representa CHECK).
-- ---------------------------------------------------------------------------

-- As integrações de antes do painel (a demo do Terraform, inserida à mão)
-- ficam como estão, ACTIVE e funcionando, com os escopos que o app client
-- delas tem no Terraform. created_by_user_id fica nulo: ninguém do painel as
-- criou.
UPDATE "integration_clients"
SET "scopes" = ARRAY['accessflow-api/members.read', 'accessflow-api/authorize']
WHERE "scopes" IS NULL;

-- Revogadas antes do painel: o momento mais próximo que se tem.
UPDATE "integration_clients"
SET "revoked_at" = "updated_at"
WHERE "status" = 'REVOKED' AND "revoked_at" IS NULL;

-- Ao menos um escopo. NOT NULL vai aqui, e não na coluna: o Prisma não
-- representa NOT NULL em lista, e o drift acusaria a diferença. O catálogo e
-- a repetição são validados no código.
ALTER TABLE "integration_clients" ADD CONSTRAINT "integration_clients_scopes_check"
  CHECK ("scopes" IS NOT NULL AND cardinality("scopes") >= 1);

-- O status manda nas outras colunas: ACTIVE e REVOKED têm app client no
-- Cognito (client_id); PROVISIONING e FAILED não. revoked_at existe só em
-- REVOKED, e revoked_by_user_id só nele (pode faltar nas revogadas antes do
-- painel). Só valores antigos do enum aparecem aqui: um valor novo não pode
-- ser usado na mesma transação em que é criado.
ALTER TABLE "integration_clients" ADD CONSTRAINT "integration_clients_status_check" CHECK (
  ("client_id" IS NOT NULL) = ("status" IN ('ACTIVE', 'REVOKED'))
  AND ("revoked_at" IS NOT NULL) = ("status" = 'REVOKED')
  AND ("revoked_by_user_id" IS NULL OR "status" = 'REVOKED')
);
