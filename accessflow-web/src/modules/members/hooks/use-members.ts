"use client";

import { createStore } from "@/infra/mocks/create-store";
import { sessionStore } from "@/infra/mocks/personas";
import { useStore } from "@/infra/mocks/use-store";
import { MEMBERS, VIEWER_USER_IDS } from "../fixtures/members";
import type { Member, MemberRole } from "../schemas";

/**
 * Mudanças feitas nesta sessão de design (remoções e trocas de papel), para a
 * lista refletir a ação enquanto a página está aberta. Chave: organização e
 * usuário. Fase 11b: some (o cache é invalidado após a mutation).
 */
interface MemberChanges {
  removed: string[];
  roles: Record<string, MemberRole>;
}

const changesStore = createStore<MemberChanges>({ removed: [], roles: {} });

const NO_MEMBERS: Member[] = [];
const keyOf = (organizationId: string, userId: string) => `${organizationId}:${userId}`;

/** Membros ativos da organização (equivale ao `organizationMembers`). */
export function useMembers(organizationId: string) {
  const { personaId } = useStore(sessionStore);
  const changes = useStore(changesStore);

  const members = (MEMBERS[organizationId] ?? NO_MEMBERS)
    .filter(({ userId }) => !changes.removed.includes(keyOf(organizationId, userId)))
    .map((member) => ({ ...member, role: changes.roles[keyOf(organizationId, member.userId)] ?? member.role }));

  return {
    members,
    viewerUserId: VIEWER_USER_IDS[personaId],
    markRemoved: (userId: string) =>
      changesStore.set((current) => ({ ...current, removed: [...current.removed, keyOf(organizationId, userId)] })),
    markRoleChanged: (userId: string, role: MemberRole) =>
      changesStore.set((current) => ({
        ...current,
        roles: { ...current.roles, [keyOf(organizationId, userId)]: role },
      })),
  };
}
