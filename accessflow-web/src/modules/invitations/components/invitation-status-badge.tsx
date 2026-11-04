import { Badge } from "@/shared/components/ui/badge";
import type { InvitationStatus } from "../schemas";

export const STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: "Pendente",
  ACCEPTED: "Aceito",
  DECLINED: "Recusado",
  REVOKED: "Revogado",
  EXPIRED: "Expirado",
};

const VARIANTS = {
  PENDING: "warning",
  ACCEPTED: "success",
  DECLINED: "outline",
  REVOKED: "destructive",
  EXPIRED: "outline",
} as const;

/** Sempre com texto: a cor nunca é o único sinal. */
export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  return <Badge variant={VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}
