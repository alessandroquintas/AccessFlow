export function clampPageSize(
  first: number | null | undefined,
  { fallback = 20, max = 50 } = {},
): number {
  if (first === undefined || first === null) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(first), 1), max);
}
