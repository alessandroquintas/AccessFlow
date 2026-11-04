"use client";

import { createStore } from "@/infra/mocks/create-store";
import { useStore } from "@/infra/mocks/use-store";
import { ORGANIZATION_INVITATIONS } from "../fixtures/organization-invitations";
import type { OrganizationInvitation } from "../schemas";

/**
 * Convites enviados, renovados ou revogados nesta sessão de design, por
 * organização, para a lista refletir a ação enquanto a página está aberta.
 * Fase 11b: some (o cache é invalidado após a mutation).
 */
const changesStore = createStore<Record<string, OrganizationInvitation[]>>({});

const NO_INVITATIONS: OrganizationInvitation[] = [];

const VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

/** Convites da organização (equivale ao `organizationInvitations`). */
export function useOrganizationInvitations(organizationId: string) {
  const changes = useStore(changesStore);
  const invitations = changes[organizationId] ?? ORGANIZATION_INVITATIONS[organizationId] ?? NO_INVITATIONS;

  const update = (next: (current: OrganizationInvitation[]) => OrganizationInvitation[]) =>
    changesStore.set((all) => ({ ...all, [organizationId]: next(all[organizationId] ?? invitations) }));

  return {
    invitations,
    /** O convite pendente (ou vencido) para o e-mail, que um novo convite renova. */
    findRenewable: (email: string) =>
      invitations.find(
        (invitation) =>
          invitation.email === email.trim().toLowerCase() &&
          (invitation.status === "PENDING" || invitation.status === "EXPIRED"),
      ),
    /** Cria ou renova: o renovado volta ao topo com mais 7 dias e o papel escolhido. */
    markInvited: (invitation: Omit<OrganizationInvitation, "id" | "expiresAt" | "status">) =>
      update((current) => {
        const renewed = current.find(
          ({ email, status }) => email === invitation.email && (status === "PENDING" || status === "EXPIRED"),
        );
        const saved: OrganizationInvitation = {
          ...invitation,
          id: renewed?.id ?? `oinv-${Date.now()}`,
          expiresAt: new Date(Date.now() + VALIDITY_MS).toISOString(),
          status: "PENDING",
        };
        return [saved, ...current.filter(({ id }) => id !== saved.id)];
      }),
    markRevoked: (id: string) =>
      update((current) =>
        current.map((invitation) => (invitation.id === id ? { ...invitation, status: "REVOKED" } : invitation)),
      ),
  };
}
