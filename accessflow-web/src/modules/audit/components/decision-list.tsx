import { CheckIcon, XIcon } from "lucide-react";
import { DataTable } from "@/shared/components/data-table";
import type { TableSkeletonColumn } from "@/shared/components/feedback/skeletons";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { RelativeTime } from "@/shared/components/relative-time";
import { Badge } from "@/shared/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { decisionOutcome, OUTCOME_LABELS } from "../lib/describe";
import type { AuditDirectory, Decision } from "../schemas";
import { RequestId } from "./audit-parts";

export const DECISION_COLUMNS: TableSkeletonColumn[] = [
  { label: "Quando", className: "w-32" },
  { label: "Integração", className: "w-56" },
  { label: "Usuário consultado", className: "w-48" },
  { label: "Resultado", cell: "badge", className: "w-28" },
  { label: "Permissões pedidas" },
  { label: "requestId", className: "w-48" },
];

const OUTCOME_VARIANT = { allowed: "success", denied: "destructive", partial: "warning" } as const;

function Outcome({ decision }: { decision: Decision }) {
  const outcome = decisionOutcome(decision);
  return <Badge variant={OUTCOME_VARIANT[outcome]}>{OUTCOME_LABELS[outcome]}</Badge>;
}

/** Cada chave pedida com ✓ ou ✗ (e o texto, para não depender só do ícone). */
function Results({ decision }: { decision: Decision }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {decision.results.map(({ permission, allowed }) => (
        <li key={permission} className="flex items-center gap-1">
          {allowed ? (
            <CheckIcon aria-hidden="true" className="size-3.5 text-success" />
          ) : (
            <XIcon aria-hidden="true" className="size-3.5 text-destructive" />
          )}
          <PermissionKeyTag value={permission} />
          <span className="sr-only">{allowed ? "permitida" : "negada"}</span>
        </li>
      ))}
    </ul>
  );
}

function Integration({ clientId, directory }: { clientId: string; directory: AuditDirectory }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-medium">{directory.integrations[clientId] ?? "Integração removida"}</span>
      <code translate="no" className="truncate font-mono text-xs text-muted-foreground">{clientId}</code>
    </span>
  );
}

/** O usuário consultado pode nem existir: aí fica o id. */
function Subject({ userId, directory }: { userId: string; directory: AuditDirectory }) {
  const name = directory.members[userId];
  return name ? (
    <span>{name}</span>
  ) : (
    <span className="flex min-w-0 flex-col">
      <span className="text-muted-foreground">Não é membro</span>
      <code translate="no" className="truncate font-mono text-xs text-muted-foreground">{userId}</code>
    </span>
  );
}

export function DecisionList({ decisions, directory }: { decisions: Decision[]; directory: AuditDirectory }) {
  return (
    <>
      <div className="hidden md:block">
        <DataTable className="[&_td]:whitespace-normal">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {DECISION_COLUMNS.map((column) => (
                <TableHead key={column.label} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {decisions.map((decision) => (
              <TableRow key={decision.id}>
                <TableCell className="text-muted-foreground">
                  <RelativeTime iso={decision.decidedAt} />
                </TableCell>
                <TableCell>
                  <Integration clientId={decision.clientId} directory={directory} />
                </TableCell>
                <TableCell>
                  <Subject userId={decision.subjectUserId} directory={directory} />
                </TableCell>
                <TableCell>
                  <Outcome decision={decision} />
                </TableCell>
                <TableCell>
                  <Results decision={decision} />
                </TableCell>
                <TableCell>
                  <RequestId value={decision.requestId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border px-3 py-3 md:hidden" aria-label="Decisões de acesso">
        {decisions.map((decision) => (
          <li key={decision.id} className="flex flex-col gap-2 py-3 text-sm first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <Subject userId={decision.subjectUserId} directory={directory} />
              <Outcome decision={decision} />
            </div>
            <Results decision={decision} />
            <Integration clientId={decision.clientId} directory={directory} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <RelativeTime iso={decision.decidedAt} />
              <RequestId value={decision.requestId} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
