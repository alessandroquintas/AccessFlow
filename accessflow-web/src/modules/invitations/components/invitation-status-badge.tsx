import { Badge } from "@/shared/components/ui/badge";
import type { InvitationStatus } from "../schemas";

export const STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: "Pendente",
  EXPIRED: "Expirado",
};

const VARIANTS = {
  PENDING: "warning",
  EXPIRED: "outline",
} as const;

/** Sempre com texto: a cor nunca é o único sinal. */
export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  return <Badge variant={VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}
