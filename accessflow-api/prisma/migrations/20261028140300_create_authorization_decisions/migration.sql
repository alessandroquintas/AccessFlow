-- CreateTable
CREATE TABLE "authorization_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "client_id" TEXT NOT NULL,
    "subject_user_id" UUID NOT NULL,
    "results" JSONB NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "request_id" TEXT,
    "decided_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "authorization_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "authorization_decisions_organization_id_decided_at_id_idx" ON "authorization_decisions"("organization_id", "decided_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "authorization_decisions_organization_id_subject_user_id_idx" ON "authorization_decisions"("organization_id", "subject_user_id", "decided_at" DESC, "id" DESC);


-- ---------------------------------------------------------------------------
-- Sem FK em nenhuma coluna, de propósito.
--
-- organization_id: o INSERT de uma FK pega KEY SHARE na linha da organização,
-- e toda ação administrativa a trava com FOR UPDATE. Com FK, cada authorize da
-- organização esperaria qualquer escrita administrativa em andamento nela: a
-- latência do endpoint mais chamado presa a transações alheias. O valor vem do
-- vínculo do client, já validado na requisição, e organizações não são
-- apagadas.
-- client_id: o registro fica mesmo que a integração deixe de existir.
-- subject_user_id: o sujeito pode nem existir como usuário.

-- ---------------------------------------------------------------------------
-- Escrito à mão: o Prisma não gera CHECK.

-- results: lista não vazia de { permission: texto, allowed: booleano }. O
-- `<> '[]'` no lugar de jsonb_array_length, que dá erro fora de uma lista: o
-- AND do SQL não garante a ordem de avaliação.
ALTER TABLE "authorization_decisions" ADD CONSTRAINT "authorization_decisions_results_check" CHECK (
  jsonb_typeof("results") = 'array'
  AND "results" <> '[]'::jsonb
  AND NOT jsonb_path_exists(
    "results",
    '$[*] ? (@.type() != "object" || !exists(@.permission ? (@.type() == "string")) || !exists(@.allowed ? (@.type() == "boolean")))'
  )
);

-- allowed: true só se nenhuma chave foi negada.
ALTER TABLE "authorization_decisions" ADD CONSTRAINT "authorization_decisions_allowed_check" CHECK (
  "allowed" = NOT ("results" @> '[{"allowed": false}]'::jsonb)
);
