"use client";

import { createStore } from "@/infra/mocks/create-store";
import { useStore } from "@/infra/mocks/use-store";
import { DESIGN_LIMITS, INTEGRATIONS } from "../fixtures/integrations";
import { type Integration, MAX_LIVE_INTEGRATIONS } from "../schemas";

/**
 * Integrações criadas ou revogadas nesta sessão de design, por organização.
 * Guarda só o `Integration` (como a query devolveria): o client_secret nunca
 * passa por aqui. Fase 11b: some (o cache é invalidado após a mutation).
 */
export const integrationsStore = createStore<Record<string, Integration[]>>({});

const NONE: Integration[] = [];

/** Ocupam vaga: em criação e ativas. Falhou e revogada, não. */
export const occupiesSlot = ({ status }: Integration) => status === "ACTIVE" || status === "PROVISIONING";

/** Integrações da organização (equivale ao `integrationClients`). */
export function useIntegrations(organizationId: string) {
  const changes = useStore(integrationsStore);
  const integrations = changes[organizationId] ?? INTEGRATIONS[organizationId] ?? NONE;

  const update = (next: (current: Integration[]) => Integration[]) =>
    integrationsStore.set((all) => ({ ...all, [organizationId]: next(all[organizationId] ?? integrations) }));

  return {
    integrations,
    used: integrations.filter(occupiesSlot).length,
    limit: DESIGN_LIMITS[organizationId] ?? MAX_LIVE_INTEGRATIONS,
    add: (integration: Integration) => update((current) => [integration, ...current]),
    markRevoked: (id: string, revokedAt: string) =>
      update((current) =>
        current.map((item) => (item.id === id ? { ...item, status: "REVOKED", revokedAt } : item)),
      ),
  };
}
