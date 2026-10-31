import { z } from "zod";

/**
 * Para onde voltar depois de entrar: só caminhos desta aplicação. "//site" e
 * "/\\site" seriam lidos pelo navegador como outro domínio (redirecionamento aberto).
 */
export const returnToSchema = z
  .string()
  .startsWith("/")
  .refine((path) => !path.startsWith("//") && !path.startsWith("/\\"), "Caminho externo.");

export type ReturnTo = z.infer<typeof returnToSchema>;

/** O `next` da URL, se for um caminho seguro; senão, nenhum. */
export const parseReturnTo = (value: string | null): ReturnTo | null => {
  const result = returnToSchema.safeParse(value);
  return result.success ? result.data : null;
};
