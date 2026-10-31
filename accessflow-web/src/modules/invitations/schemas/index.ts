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

export type AssignedRole = z.infer<typeof assignedRoleSchema>;
export type MyInvitation = z.infer<typeof myInvitationSchema>;
