import { LocalDate } from "@/shared/components/local-date";
import { Badge } from "@/shared/components/ui/badge";
import type { Integration } from "../schemas";

const STATUS = {
  ACTIVE: { label: "Ativa", variant: "success" },
  PROVISIONING: { label: "Provisionando", variant: "warning" },
  FAILED: { label: "Falhou", variant: "destructive" },
  REVOKED: { label: "Revogada", variant: "outline" },
} as const;

/** Badge com texto e, quando ajuda, a explicação do status embaixo. */
export function IntegrationStatus({ integration }: { integration: Integration }) {
  const { label, variant } = STATUS[integration.status];
  return (
    <span className="flex flex-col items-start gap-1">
      <Badge variant={variant}>{label}</Badge>
      {integration.status === "FAILED" && (
        <span className="text-xs whitespace-normal text-muted-foreground">
          A criação não foi concluída; não ocupa vaga.
        </span>
      )}
      {integration.status === "PROVISIONING" && (
        <span className="text-xs whitespace-normal text-muted-foreground">Em criação no provedor de login.</span>
      )}
      {integration.status === "REVOKED" && integration.revokedAt && (
        <span className="text-xs text-muted-foreground">
          em <LocalDate iso={integration.revokedAt} />
        </span>
      )}
    </span>
  );
}
