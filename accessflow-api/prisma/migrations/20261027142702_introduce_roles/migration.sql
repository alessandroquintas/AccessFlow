-- Papéis por organização. O enum fixo "MembershipRole" de memberships e
-- invitations dá lugar a uma FK para o papel de sistema equivalente da
-- MESMA organização. A DDL segue o que o Prisma gera para o schema; a parte
-- de dados (papéis, permissões, role_id e verificação) é escrita à mão.

-- CreateEnum
CREATE TYPE "RoleSystemKey" AS ENUM ('OWNER', 'MEMBER');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_key" "RoleSystemKey",
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_key" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_system_key_key" ON "roles"("organization_id", "system_key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_id_organization_id_key" ON "roles"("id", "organization_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dados: os dois papéis de sistema de cada organização existente. O OWNER
-- não tem linhas em role_permissions (tem todas, calculadas no código); o
-- MEMBER começa com members:read, que é o comportamento atual.
INSERT INTO "roles" ("id", "organization_id", "name", "system_key", "created_at", "updated_at")
SELECT gen_random_uuid(), o."id", s."name", s."system_key"::"RoleSystemKey", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN (VALUES ('OWNER', 'Owner'), ('MEMBER', 'Member')) AS s ("system_key", "name");

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT "id", 'members:read' FROM "roles" WHERE "system_key" = 'MEMBER';

-- Dados: role_id a partir da coluna antiga, sempre com o papel da própria
-- organização. Nullable até a verificação abaixo.
ALTER TABLE "memberships" ADD COLUMN "role_id" UUID;

ALTER TABLE "invitations" ADD COLUMN "role_id" UUID;

UPDATE "memberships" m
SET "role_id" = r."id"
FROM "roles" r
WHERE r."organization_id" = m."organization_id"
  AND r."system_key"::text = m."role"::text;

UPDATE "invitations" i
SET "role_id" = r."id"
FROM "roles" r
WHERE r."organization_id" = i."organization_id"
  AND r."system_key"::text = i."role"::text;

-- Verificação: aborta a migration (e nada dela fica gravado) se algum
-- membership ou convite ficou sem papel, com papel de outra organização ou
-- com papel diferente do que tinha, ou se alguma organização ficou sem os
-- dois papéis de sistema.
DO $$
DECLARE
  bad_memberships INTEGER;
  bad_invitations INTEGER;
  incomplete_organizations INTEGER;
BEGIN
  SELECT count(*) INTO bad_memberships
  FROM "memberships" m
  LEFT JOIN "roles" r ON r."id" = m."role_id"
  WHERE r."id" IS NULL
     OR r."organization_id" <> m."organization_id"
     OR r."system_key"::text IS DISTINCT FROM m."role"::text;

  SELECT count(*) INTO bad_invitations
  FROM "invitations" i
  LEFT JOIN "roles" r ON r."id" = i."role_id"
  WHERE r."id" IS NULL
     OR r."organization_id" <> i."organization_id"
     OR r."system_key"::text IS DISTINCT FROM i."role"::text;

  SELECT count(*) INTO incomplete_organizations
  FROM "organizations" o
  WHERE (
    SELECT count(*) FROM "roles" r
    WHERE r."organization_id" = o."id" AND r."system_key" IS NOT NULL
  ) <> 2;

  IF bad_memberships > 0 OR bad_invitations > 0 OR incomplete_organizations > 0 THEN
    RAISE EXCEPTION 'introduce_roles: % membership(s) e % convite(s) sem o papel de sistema correto da própria organização; % organização(ões) sem os dois papéis de sistema.',
      bad_memberships, bad_invitations, incomplete_organizations;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "memberships" ALTER COLUMN "role_id" SET NOT NULL,
DROP COLUMN "role";

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "role_id" SET NOT NULL,
DROP COLUMN "role";

-- DropEnum
DROP TYPE "MembershipRole";

-- CreateIndex
CREATE INDEX "memberships_role_id_organization_id_idx" ON "memberships"("role_id", "organization_id");

-- CreateIndex
CREATE INDEX "invitations_role_id_organization_id_idx" ON "invitations"("role_id", "organization_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_organization_id_fkey" FOREIGN KEY ("role_id", "organization_id") REFERENCES "roles"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_organization_id_fkey" FOREIGN KEY ("role_id", "organization_id") REFERENCES "roles"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
