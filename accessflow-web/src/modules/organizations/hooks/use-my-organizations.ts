"use client";

import { sessionStore } from "@/infra/mocks/personas";
import { useStore } from "@/infra/mocks/use-store";
import { MY_ORGANIZATIONS } from "../fixtures/organizations";

export function useMyOrganizations() {
  const { personaId } = useStore(sessionStore);
  return MY_ORGANIZATIONS[personaId];
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
