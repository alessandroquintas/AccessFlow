-- Só a coluna nova, nula e sem default: nenhuma linha é reescrita e o
-- trigger de só acréscimos (BEFORE UPDATE OR DELETE, por linha) não dispara.
-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "request_id" TEXT;
