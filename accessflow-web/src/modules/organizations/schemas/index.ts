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

export type ViewerRole = z.infer<typeof viewerRoleSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationForm = z.infer<typeof organizationFormSchema>;
export type OrganizationSettingsForm = z.infer<typeof organizationSettingsFormSchema>;
