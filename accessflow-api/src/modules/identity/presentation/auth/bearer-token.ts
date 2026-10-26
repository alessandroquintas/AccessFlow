/** Token do header `Authorization: Bearer <token>`, ou null se o header estiver ausente ou malformado. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0)
    return null;

  return token;
}
