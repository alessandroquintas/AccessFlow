import { z } from "zod";

export const assignedRoleSchema = z.object({
  name: z.string(),
  kind: z.enum(["OWNER", "MEMBER", "CUSTOM"]),
});

/** Convite recebido pela persona (equivale ao `MyInvitation`). */
export const myInvitationSchema = z.object({
  id: z.string(),
  organization: z.object({ name: z.string(), slug: z.string() }),
  assignedRole: assignedRoleSchema,
  invitedByName: z.string(),
  expiresAt: z.iso.datetime(),
});

/** A API lista só os pendentes, com os vencidos (EXPIRED) incluídos. */
export const invitationStatusSchema = z.enum(["PENDING", "EXPIRED"]);

/** Convite enviado pela organização (equivale ao `OrganizationInvitation`). */
export const organizationInvitationSchema = z.object({
  id: z.string(),
  email: z.email(),
  assignedRole: assignedRoleSchema.extend({ id: z.string() }),
  invitedByName: z.string(),
  expiresAt: z.iso.datetime(),
  /** EXPIRED é calculado pela API: um PENDING com o prazo vencido. */
  status: invitationStatusSchema,
});

export const inviteMemberFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail de quem você quer convidar.")
    .pipe(z.email("Informe um e-mail válido, como nome@empresa.com.br.")),
  roleId: z.string().min(1, "Escolha um papel."),
});

export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
export type OrganizationInvitation = z.infer<typeof organizationInvitationSchema>;
export type InviteMemberForm = z.infer<typeof inviteMemberFormSchema>;
export type AssignedRole = z.infer<typeof assignedRoleSchema>;
export type MyInvitation = z.infer<typeof myInvitationSchema>;
