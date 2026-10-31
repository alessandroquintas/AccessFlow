import type { PersonaId } from "@/infra/mocks/personas";
import type { Profile } from "../schemas";

export const PROFILES: Record<Exclude<PersonaId, "first-access">, Profile> = {
  owner: { name: "Helena Duarte", email: "helena.duarte@valeverde.coop.br", createdAt: "2025-09-15T13:00:00.000Z" },
  member: { name: "Rafael Moreira", email: "rafael.moreira@valeverde.coop.br", createdAt: "2026-01-04T13:00:00.000Z" },
  custom: { name: "Camila Teixeira", email: "camila.teixeira@valeverde.coop.br", createdAt: "2026-01-22T13:00:00.000Z" },
};

/** O que viria do token do Cognito para quem ainda não tem perfil. */
export const FIRST_ACCESS_EMAIL = "joana.prado@exemplo.com.br";
