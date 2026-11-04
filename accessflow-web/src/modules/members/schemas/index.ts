import { z } from "zod";

export const memberRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["OWNER", "MEMBER", "CUSTOM"]),
});

/** Membro ativo da organização (equivale ao `OrganizationMember`). */
export const memberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.email(),
  role: memberRoleSchema,
  joinedAt: z.iso.datetime(),
});

/** Busca e filtro da lista, só na interface. roleId null: todos os papéis. */
export const memberFiltersSchema = z.object({
  query: z.string(),
  roleId: z.string().nullable(),
});

export type MemberRole = z.infer<typeof memberRoleSchema>;
export type Member = z.infer<typeof memberSchema>;
export type MemberFilters = z.infer<typeof memberFiltersSchema>;
