-- CreateEnum
CREATE TYPE "SecurityActorType" AS ENUM ('USER', 'MACHINE');

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "actor_type" "SecurityActorType" NOT NULL,
    "actor_user_id" UUID,
    "actor_client_id" TEXT,
    "event" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "request_id" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_events_organization_id_occurred_at_id_idx" ON "security_events"("organization_id", "occurred_at" DESC, "id" DESC);



-- ---------------------------------------------------------------------------
-- Escrito à mão: o Prisma não representa CHECK.
-- ---------------------------------------------------------------------------

-- Sem FK em nenhuma coluna, de propósito.
--
-- organization_id: a negação desfaz a transação da ação, então o evento é
-- gravado fora dela, por outra conexão. A ação pode estar segurando FOR UPDATE
-- na organização; com FK, o INSERT pediria KEY SHARE nessa linha e esperaria a
-- transação que, por sua vez, espera o INSERT: a aplicação trava sem o Postgres
-- ver deadlock. Além disso, a coluna é nula em evento de client não cadastrado.
-- actor_user_id: pelo mesmo motivo, o INSERT nunca espera trava de linha
-- alheia.

-- O ator tem exatamente a coluna do seu tipo: USER só actor_user_id, MACHINE
-- só actor_client_id.
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_actor_check" CHECK (
  ("actor_type" = 'USER' AND "actor_user_id" IS NOT NULL AND "actor_client_id" IS NULL)
  OR ("actor_type" = 'MACHINE' AND "actor_user_id" IS NULL AND "actor_client_id" IS NOT NULL)
);

-- details é sempre um objeto JSON.
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_details_check"
  CHECK (jsonb_typeof("details") = 'object');
