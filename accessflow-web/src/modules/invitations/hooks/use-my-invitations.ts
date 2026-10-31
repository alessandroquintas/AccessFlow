"use client";

import { createStore } from "@/infra/mocks/create-store";
import { sessionStore } from "@/infra/mocks/personas";
import { useStore } from "@/infra/mocks/use-store";
import { MY_INVITATIONS } from "../fixtures/my-invitations";

/**
 * Convites já respondidos nesta sessão de design, só para a lista e o
 * contador da sidebar ficarem coerentes. Fase 11b: some (a API devolve só os
 * pendentes, e o cache é invalidado após aceitar ou recusar).
 */
const answeredStore = createStore<string[]>([]);

export function useMyInvitations() {
  const { personaId } = useStore(sessionStore);
  const answered = useStore(answeredStore);
  const invitations = MY_INVITATIONS[personaId].filter(({ id }) => !answered.includes(id));

  return {
    invitations,
    markAnswered: (id: string) => answeredStore.set((ids) => [...ids, id]),
  };
}
