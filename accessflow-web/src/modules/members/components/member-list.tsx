import { DataTable } from "@/shared/components/data-table";
import type { TableSkeletonColumn } from "@/shared/components/feedback/skeletons";
import { LocalDate } from "@/shared/components/local-date";
import { RoleBadge } from "@/shared/components/role-badge";
import { Badge } from "@/shared/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import type { Member } from "../schemas";
import { type MemberActionHandlers, MemberActionsMenu, type MemberRowActions } from "./member-actions-menu";

/** As colunas da tabela, também usadas pelo skeleton. */
export const MEMBER_COLUMNS: TableSkeletonColumn[] = [
  { label: "Nome", className: "w-1/4" },
  { label: "E-mail" },
  { label: "Papel", cell: "badge", className: "w-40" },
  { label: "Entrou em", cell: "date", className: "w-32 text-right" },
  { label: "Ações", hideLabel: true, cell: "action", className: "w-12 text-right" },
];

interface MemberListProps extends MemberActionHandlers {
  members: Member[];
  viewerUserId: string | null;
  actionsFor: (member: Member) => MemberRowActions;
}

function YouBadge() {
  return <Badge variant="outline">você</Badge>;
}

/**
 * Do tablet para cima, tabela. No celular, lista de linhas empilhadas: a
 * tabela de cinco colunas não cabe em 390 px, e rolando de lado o menu de
 * ações (a última coluna) ficaria fora da tela.
 */
export function MemberList({ members, viewerUserId, actionsFor, ...handlers }: MemberListProps) {
  return (
    <>
      <div className="hidden md:block">
        <DataTable>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {MEMBER_COLUMNS.map((column) => (
                <TableHead key={column.label} className={column.className}>
                  {column.hideLabel ? <span className="sr-only">{column.label}</span> : column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isViewer = member.userId === viewerUserId;
              return (
                <TableRow key={member.userId}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <span className="truncate">{member.name}</span>
                      {isViewer && <YouBadge />}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <RoleBadge {...member.role} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <LocalDate iso={member.joinedAt} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MemberActionsMenu member={member} actions={actionsFor(member)} isViewer={isViewer} {...handlers} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTable>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border px-3 py-3 md:hidden" aria-label="Membros">
        {members.map((member) => {
          const isViewer = member.userId === viewerUserId;
          return (
            <li key={member.userId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span className="truncate">{member.name}</span>
                  {isViewer && <YouBadge />}
                </span>
                <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <RoleBadge {...member.role} />
                  <span>
                    Entrou em <LocalDate iso={member.joinedAt} />
                  </span>
                </span>
              </div>
              <MemberActionsMenu member={member} actions={actionsFor(member)} isViewer={isViewer} {...handlers} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
