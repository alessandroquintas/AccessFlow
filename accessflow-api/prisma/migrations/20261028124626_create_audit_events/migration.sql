-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'MACHINE', 'SYSTEM');

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_user_id" UUID,
    "actor_client_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_organization_id_occurred_at_id_idx" ON "audit_events"("organization_id", "occurred_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Escrito à mão: o Prisma não representa CHECK nem trigger (e não os compara
-- no drift).
-- ---------------------------------------------------------------------------

-- O ator tem exatamente as colunas do seu tipo: USER só actor_user_id,
-- MACHINE só actor_client_id, SYSTEM nenhuma.
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_check" CHECK (
  ("actor_type" = 'USER' AND "actor_user_id" IS NOT NULL AND "actor_client_id" IS NULL)
  OR ("actor_type" = 'MACHINE' AND "actor_user_id" IS NULL AND "actor_client_id" IS NOT NULL)
  OR ("actor_type" = 'SYSTEM' AND "actor_user_id" IS NULL AND "actor_client_id" IS NULL)
);

-- details é sempre um objeto JSON.
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_details_check"
  CHECK (jsonb_typeof("details") = 'object');

-- Só acréscimos: UPDATE e DELETE de linha são recusados. TRUNCATE não dispara
-- trigger de linha (a limpeza dos testes continua funcionando).
CREATE FUNCTION "audit_events_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events só aceita INSERT: % recusado', TG_OP;
END;
$$;

CREATE TRIGGER "audit_events_append_only"
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION "audit_events_append_only"();
