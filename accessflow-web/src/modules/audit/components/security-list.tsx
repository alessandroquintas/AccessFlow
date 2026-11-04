import { DataTable } from "@/shared/components/data-table";
import type { TableSkeletonColumn } from "@/shared/components/feedback/skeletons";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { RelativeTime } from "@/shared/components/relative-time";
import { ScopeTag } from "@/shared/components/scope-tag";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { SECURITY_EVENT_LABELS } from "../lib/describe";
import type { AuditDirectory, SecurityEvent } from "../schemas";
import { RequestId } from "./audit-parts";

export const SECURITY_COLUMNS: TableSkeletonColumn[] = [
  { label: "Quando", className: "w-32" },
  { label: "Evento", className: "w-64" },
  { label: "Ator", className: "w-52" },
  { label: "Detalhes" },
  { label: "requestId", className: "w-48" },
];

function Actor({ event, directory }: { event: SecurityEvent; directory: AuditDirectory }) {
  if (event.actor.type === "MACHINE") {
    return (
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">
          {(event.actor.clientId && directory.integrations[event.actor.clientId]) ?? "Integração de outra organização"}
        </span>
        <code translate="no" className="truncate font-mono text-xs text-muted-foreground">{event.actor.clientId}</code>
      </span>
    );
  }
  return <span className="font-medium">{event.actor.name ?? "Usuário sem perfil"}</span>;
}

/** operation e permission nos access.*; route e escopos exigidos nos machine.*. */
function Details({ event }: { event: SecurityEvent }) {
  const { operation, permission, route, requiredScopes } = event.details;
  return (
    <dl className="flex flex-col gap-1 text-xs">
      {operation && (
        <div className="flex flex-wrap items-center gap-1.5">
          <dt className="text-muted-foreground">Operação</dt>
          <dd>
            <code translate="no" className="font-mono">{operation}</code>
          </dd>
        </div>
      )}
      {permission && (
        <div className="flex flex-wrap items-center gap-1.5">
          <dt className="text-muted-foreground">Permissão exigida</dt>
          <dd>
            <PermissionKeyTag value={permission} />
          </dd>
        </div>
      )}
      {route && (
        <div className="flex flex-wrap items-center gap-1.5">
          <dt className="text-muted-foreground">Rota</dt>
          <dd>
            <code translate="no" className="font-mono break-all">{route}</code>
          </dd>
        </div>
      )}
      {requiredScopes && requiredScopes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <dt className="text-muted-foreground">Escopos exigidos</dt>
          <dd className="flex flex-wrap gap-1">
            {requiredScopes.map((scope) => (
              <ScopeTag key={scope} value={scope} />
            ))}
          </dd>
        </div>
      )}
    </dl>
  );
}

export function SecurityList({ events, directory }: { events: SecurityEvent[]; directory: AuditDirectory }) {
  return (
    <>
      <div className="hidden md:block">
        <DataTable className="[&_td]:whitespace-normal">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {SECURITY_COLUMNS.map((column) => (
                <TableHead key={column.label} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="text-muted-foreground">
                  <RelativeTime iso={event.occurredAt} />
                </TableCell>
                <TableCell>{SECURITY_EVENT_LABELS[event.event]}</TableCell>
                <TableCell>
                  <Actor event={event} directory={directory} />
                </TableCell>
                <TableCell>
                  <Details event={event} />
                </TableCell>
                <TableCell>
                  <RequestId value={event.requestId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border px-3 py-3 md:hidden" aria-label="Eventos de segurança">
        {events.map((event) => (
          <li key={event.id} className="flex flex-col gap-2 py-3 text-sm first:pt-0 last:pb-0">
            <span className="font-medium">{SECURITY_EVENT_LABELS[event.event]}</span>
            <Actor event={event} directory={directory} />
            <Details event={event} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <RelativeTime iso={event.occurredAt} />
              <RequestId value={event.requestId} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
