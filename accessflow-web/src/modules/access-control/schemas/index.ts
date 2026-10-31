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

export type PermissionKey = z.infer<typeof permissionKeySchema>;
export type PermissionDefinition = z.infer<typeof permissionDefinitionSchema>;
