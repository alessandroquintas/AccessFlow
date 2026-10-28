-- CreateIndex
CREATE INDEX "authorization_decisions_decided_at_idx" ON "authorization_decisions"("decided_at");

-- CreateIndex
CREATE INDEX "security_events_occurred_at_idx" ON "security_events"("occurred_at");



-- ---------------------------------------------------------------------------
-- Escrito à mão: retenção das decisões do authorize e dos eventos de
-- segurança. O Prisma não representa função nem trigger (e não os compara no
-- drift). audit_events fica fora: sem expurgo.
-- ---------------------------------------------------------------------------

-- O prazo de cada tabela existe só aqui. O trigger abaixo e o expurgo
-- (npm run purge:events) leem destas funções; o código não tem o número.
-- Para mudar o prazo, uma migration nova com CREATE OR REPLACE FUNCTION.
CREATE FUNCTION "authorization_decisions_retention"() RETURNS interval
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT interval '90 days' $$;

CREATE FUNCTION "security_events_retention"() RETURNS interval
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT interval '180 days' $$;

-- UPDATE nunca: o registro é como foi gravado.
CREATE FUNCTION "refuse_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% não aceita UPDATE', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "authorization_decisions_refuse_update"
  BEFORE UPDATE ON "authorization_decisions"
  FOR EACH ROW EXECUTE FUNCTION "refuse_update"();

CREATE TRIGGER "security_events_refuse_update"
  BEFORE UPDATE ON "security_events"
  FOR EACH ROW EXECUTE FUNCTION "refuse_update"();

-- DELETE só depois do prazo. now() é o início da transação: o expurgo, que
-- escolhe as linhas com o mesmo now() e o mesmo prazo, nunca esbarra aqui.
-- TRUNCATE não dispara trigger de linha (a limpeza dos testes continua
-- funcionando).
CREATE FUNCTION "authorization_decisions_retention_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."decided_at" >= now() - "authorization_decisions_retention"() THEN
    RAISE EXCEPTION 'authorization_decisions: decisão % ainda dentro da retenção de %',
      OLD."id", "authorization_decisions_retention"();
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "authorization_decisions_retention_guard"
  BEFORE DELETE ON "authorization_decisions"
  FOR EACH ROW EXECUTE FUNCTION "authorization_decisions_retention_guard"();

CREATE FUNCTION "security_events_retention_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."occurred_at" >= now() - "security_events_retention"() THEN
    RAISE EXCEPTION 'security_events: evento % ainda dentro da retenção de %',
      OLD."id", "security_events_retention"();
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "security_events_retention_guard"
  BEFORE DELETE ON "security_events"
  FOR EACH ROW EXECUTE FUNCTION "security_events_retention_guard"();
