/** Períodos do filtro; cada aba oferece só os que cabem na retenção dela. */
export const PERIODS = {
  "24h": { label: "Últimas 24 horas", hours: 24 },
  "7d": { label: "Últimos 7 dias", hours: 7 * 24 },
  "30d": { label: "Últimos 30 dias", hours: 30 * 24 },
  "90d": { label: "Últimos 90 dias", hours: 90 * 24 },
  "180d": { label: "Últimos 180 dias", hours: 180 * 24 },
  all: { label: "Todo o período", hours: null },
} as const;

export type Period = keyof typeof PERIODS;

/**
 * Dentro do período? `now` null (servidor e hidratação): ainda não filtra.
 * Fase 11b: vira o occurredFrom/decidedFrom do filtro da query.
 */
export const withinPeriod = (iso: string, period: Period, now: number | null) => {
  const { hours } = PERIODS[period];
  return hours === null || now === null || now - new Date(iso).getTime() <= hours * 60 * 60 * 1000;
};

/** Do tamanho de uma página das queries de auditoria (Fase 11b: `first`/`after`). */
export const PAGE_SIZE = 15;
