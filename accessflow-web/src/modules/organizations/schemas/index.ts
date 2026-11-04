import { z } from "zod";

/** Papel do viewer na organização (o detalhe do papel personalizado vem no nome). */
export const viewerRoleSchema = z.object({
  name: z.string(),
  kind: z.enum(["OWNER", "MEMBER", "CUSTOM"]),
});

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.iso.datetime(),
  memberCount: z.number().int().nonnegative(),
  viewerRole: viewerRoleSchema,
});

export const organizationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe pelo menos 2 caracteres.")
    .max(100, "Use no máximo 100 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "Use pelo menos 3 caracteres.")
    .max(50, "Use no máximo 50 caracteres.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use letras minúsculas, números e hífens entre eles.",
    ),
});

export const organizationSettingsFormSchema = organizationFormSchema.pick({ name: true });

/** Contagens dos cartões da visão geral (os membros vêm de `memberCount`). */
export const organizationSummarySchema = z.object({
  pendingInvitations: z.number().int().nonnegative(),
  roles: z.number().int().nonnegative(),
  activeIntegrations: z.number().int().nonnegative(),
});

/** Uma linha de "Atividade recente": um evento da trilha de auditoria, já descrito. */
export const activityEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(["member", "invitation", "role", "permission", "integration", "organization"]),
  actorName: z.string(),
  /** O que foi feito, depois do nome de quem fez: "convidou ana.lima@… com o papel MEMBER". */
  summary: z.string(),
  permission: z.string().optional(),
  occurredAt: z.iso.datetime(),
});

export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;
export type ActivityEntry = z.infer<typeof activityEntrySchema>;
export type ViewerRole = z.infer<typeof viewerRoleSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationForm = z.infer<typeof organizationFormSchema>;
export type OrganizationSettingsForm = z.infer<typeof organizationSettingsFormSchema>;
