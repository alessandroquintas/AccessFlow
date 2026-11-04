import { z } from "zod";

/** Chave `recurso:ação`: minúsculas, dígitos e hífen, começando por letra. */
export const permissionKeySchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,39}$/,
    "Use o formato recurso:ação, com letras minúsculas, dígitos e hífen.",
  );

export const permissionDefinitionSchema = z.object({
  key: permissionKeySchema,
  description: z.string().min(1).max(200),
});

/** Limites da API (Role.MAX_CUSTOM_PER_ORGANIZATION e CustomPermission.MAX_PER_ORGANIZATION). */
export const MAX_CUSTOM_ROLES = 50;
export const MAX_CUSTOM_PERMISSIONS = 100;
export const MAX_PERMISSION_DESCRIPTION = 200;

/** Recursos do sistema: uma permissão personalizada não pode usá-los (RESERVED_PERMISSION_RESOURCES). */
export const RESERVED_RESOURCES = [
  "organizations",
  "members",
  "invitations",
  "roles",
  "permissions",
  "audit",
  "integrations",
] as const;

const PART = /^[a-z][a-z0-9-]*$/;

/** Uma parte da chave (recurso ou ação): diz exatamente o que está errado. */
function checkPart(part: string, label: "recurso" | "ação", ctx: z.RefinementCtx) {
  if (part.length === 0) {
    ctx.addIssue({ code: "custom", message: `Informe ${label === "recurso" ? "o recurso" : "a ação"}.` });
  } else if (/[^a-z0-9-]/.test(part)) {
    ctx.addIssue({ code: "custom", message: "Use só letras minúsculas, dígitos e hífen, sem acento nem espaço." });
  } else if (!PART.test(part)) {
    ctx.addIssue({ code: "custom", message: `${label === "recurso" ? "O recurso" : "A ação"} deve começar por letra.` });
  } else if (part.length > 40) {
    ctx.addIssue({ code: "custom", message: `${label === "recurso" ? "O recurso" : "A ação"} tem no máximo 40 caracteres.` });
  }
}

/**
 * Chave de uma permissão personalizada, validada ao digitar: o formato
 * `recurso:ação` (como o `permissionKeySchema`) e os recursos reservados.
 */
export const customPermissionKeySchema = z.string().superRefine((value, ctx) => {
  const separator = value.indexOf(":");
  if (separator === -1 || value.indexOf(":", separator + 1) !== -1) {
    ctx.addIssue({ code: "custom", message: "Use o formato recurso:ação, com um dois-pontos entre os dois." });
    return;
  }
  const resource = value.slice(0, separator);
  checkPart(resource, "recurso", ctx);
  checkPart(value.slice(separator + 1), "ação", ctx);
  if ((RESERVED_RESOURCES as readonly string[]).includes(resource)) {
    ctx.addIssue({
      code: "custom",
      message: `“${resource}” é um recurso do sistema. Escolha outro nome para o recurso.`,
    });
  }
});

export const permissionDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Descreva o que a permissão autoriza.")
  .max(MAX_PERMISSION_DESCRIPTION, `Use no máximo ${MAX_PERMISSION_DESCRIPTION} caracteres.`);

export const createPermissionFormSchema = z.object({
  key: customPermissionKeySchema,
  description: permissionDescriptionSchema,
});

export const editPermissionFormSchema = z.object({ description: permissionDescriptionSchema });

/** Papel da organização com as permissões que concede (equivale ao `OrganizationRole`). */
export const organizationRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["OWNER", "MEMBER", "CUSTOM"]),
  /** No OWNER, o catálogo inteiro (a API resolve as efetivas). */
  permissions: z.array(permissionKeySchema),
  memberCount: z.number().int().nonnegative(),
  /**
   * Convites pendentes com o papel. A API não expõe por papel: na Fase 11b,
   * contar a partir do `organizationInvitations`.
   */
  pendingInvitationCount: z.number().int().nonnegative(),
});

/** Nome do papel como a API normaliza: sem espaços nas pontas e com os internos colapsados. */
export const roleFormSchema = z.object({
  name: z
    .string()
    .transform((value) => value.normalize("NFC").trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Informe o nome do papel.").max(50, "Use no máximo 50 caracteres.")),
  permissions: z.array(permissionKeySchema),
});

export type PermissionKey = z.infer<typeof permissionKeySchema>;
export type PermissionDefinition = z.infer<typeof permissionDefinitionSchema>;
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type RoleForm = z.input<typeof roleFormSchema>;
export type CreatePermissionForm = z.infer<typeof createPermissionFormSchema>;
export type EditPermissionForm = z.infer<typeof editPermissionFormSchema>;
