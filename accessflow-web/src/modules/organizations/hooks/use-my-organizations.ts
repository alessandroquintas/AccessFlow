"use client";

import { createStore } from "@/infra/mocks/create-store";
import { sessionStore } from "@/infra/mocks/personas";
import { useStore } from "@/infra/mocks/use-store";
import { MY_ORGANIZATIONS } from "../fixtures/organizations";

/**
 * Nomes trocados em Configurações nesta sessão de design, por id, para a
 * sidebar e a lista refletirem a mudança. Fase 11b: some (o cache é
 * invalidado após o updateOrganization).
 */
const renamedStore = createStore<Record<string, string>>({});

export const renameOrganization = (id: string, name: string) =>
  renamedStore.set((names) => ({ ...names, [id]: name }));

export function useMyOrganizations() {
  const { personaId } = useStore(sessionStore);
  const renamed = useStore(renamedStore);
  return MY_ORGANIZATIONS[personaId].map((organization) =>
    renamed[organization.id] ? { ...organization, name: renamed[organization.id] } : organization,
  );
}

/**
 * A organização ativa: a escolhida no seletor, se a persona ainda é membro
 * dela; senão, a primeira. undefined quando a persona não tem organização.
 */
export function useCurrentOrganization() {
  const { activeOrganizationId } = useStore(sessionStore);
  const organizations = useMyOrganizations();
  return organizations.find(({ id }) => id === activeOrganizationId) ?? organizations[0];
}
