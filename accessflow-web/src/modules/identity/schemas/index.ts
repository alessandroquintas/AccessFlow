import { z } from "zod";

export const profileSchema = z.object({
  name: z.string(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});

export const profileFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe pelo menos 2 caracteres.")
    .max(100, "Use no máximo 100 caracteres."),
});

export type Profile = z.infer<typeof profileSchema>;
export type ProfileForm = z.infer<typeof profileFormSchema>;
