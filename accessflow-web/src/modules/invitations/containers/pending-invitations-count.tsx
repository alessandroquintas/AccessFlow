"use client";

import { useMyInvitations } from "../hooks/use-my-invitations";

/** Quantos convites aguardam resposta; nada quando não há. */
export function PendingInvitationsCount({
  children,
}: {
  children: (count: number) => React.ReactNode;
}) {
  const { invitations } = useMyInvitations();
  return invitations.length > 0 ? children(invitations.length) : null;
}
