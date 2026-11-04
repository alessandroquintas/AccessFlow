import { EyeIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/shared/components/data-table";
import type { TableSkeletonColumn } from "@/shared/components/feedback/skeletons";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { RoleBadge } from "@/shared/components/role-badge";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { pluralize } from "@/shared/lib/format";
import type { OrganizationRole } from "../schemas";

/** As colunas da tabela, também usadas pelo skeleton. */
export const ROLE_COLUMNS: TableSkeletonColumn[] = [
  { label: "Papel", cell: "badge", className: "w-48" },
  { label: "Tipo", className: "w-32" },
  { label: "Permissões" },
  { label: "Membros", className: "w-32" },
  { label: "Ações", hideLabel: true, cell: "action", className: "w-12 text-right" },
];

/** Quantas chaves a lista mostra antes do "+N". */
const PREVIEW = 3;

export interface RoleRowState {
  /** Pode editar (roles:manage e não é o OWNER). */
  editable: boolean;
  /** Excluir: ausente quando não se aplica; `blocked` com o motivo. */
  remove?: { blocked?: string };
}

interface RoleListProps {
  roles: OrganizationRole[];
  stateFor: (role: OrganizationRole) => RoleRowState;
  /** Com members:read, a contagem leva à lista de membros filtrada pelo papel. */
  canSeeMembers: boolean;
  onDelete: (role: OrganizationRole) => void;
}

function RoleName({ role }: { role: OrganizationRole }) {
  const label = role.kind === "CUSTOM" ? role.name : <RoleBadge name={role.name} kind={role.kind} />;
  return (
    <Link href={`/roles/${role.id}`} className="font-medium hover:underline focus-visible:underline focus-visible:outline-none">
      {label}
    </Link>
  );
}

function PermissionSummary({ role }: { role: OrganizationRole }) {
  if (role.kind === "OWNER") {
    return <span className="text-muted-foreground">Todas, inclusive as personalizadas</span>;
  }
  const rest = role.permissions.length - PREVIEW;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground tabular-nums">{role.permissions.length}</span>
      {role.permissions.slice(0, PREVIEW).map((key) => (
        <PermissionKeyTag key={key} value={key} />
      ))}
      {rest > 0 && <span className="text-xs text-muted-foreground">+{rest}</span>}
    </span>
  );
}

function MemberCount({ role, canSeeMembers }: { role: OrganizationRole; canSeeMembers: boolean }) {
  const text = pluralize(role.memberCount, "membro", "membros");
  if (!canSeeMembers || role.memberCount === 0) return <span className="text-muted-foreground tabular-nums">{text}</span>;
  return (
    <Link
      href={`/members?role=${role.id}`}
      className="text-primary tabular-nums hover:underline focus-visible:underline focus-visible:outline-none"
      aria-label={`${text} com o papel ${role.name}`}
    >
      {text}
    </Link>
  );
}

function RoleActions({ role, state, onDelete }: { role: OrganizationRole; state: RoleRowState; onDelete: RoleListProps["onDelete"] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Mais ações para o papel ${role.name}`} />}>
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href={`/roles/${role.id}`} />}>
            {state.editable ? <PencilIcon /> : <EyeIcon />}
            {state.editable ? (role.kind === "MEMBER" ? "Editar permissões" : "Editar papel") : "Ver papel"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {state.remove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant={state.remove.blocked ? "default" : "destructive"}
                disabled={Boolean(state.remove.blocked)}
                onClick={() => onDelete(role)}
                className="items-start data-disabled:text-muted-foreground data-disabled:opacity-100"
              >
                <Trash2Icon />
                <span className="flex flex-col gap-0.5">
                  Excluir papel
                  {state.remove.blocked && <span className="text-xs">{state.remove.blocked}</span>}
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const KIND_LABEL = { OWNER: "Sistema", MEMBER: "Sistema", CUSTOM: "Personalizado" };

/** Tabela do tablet para cima; no celular, linhas empilhadas (como em Membros). */
export function RoleList({ roles, stateFor, canSeeMembers, onDelete }: RoleListProps) {
  return (
    <>
      <div className="hidden md:block">
        <DataTable>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {ROLE_COLUMNS.map((column) => (
                <TableHead key={column.label} className={column.className}>
                  {column.hideLabel ? <span className="sr-only">{column.label}</span> : column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <RoleName role={role} />
                </TableCell>
                <TableCell className="text-muted-foreground">{KIND_LABEL[role.kind]}</TableCell>
                <TableCell>
                  <PermissionSummary role={role} />
                </TableCell>
                <TableCell>
                  <MemberCount role={role} canSeeMembers={canSeeMembers} />
                </TableCell>
                <TableCell className="text-right">
                  <RoleActions role={role} state={stateFor(role)} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border px-3 py-3 md:hidden" aria-label="Papéis">
        {roles.map((role) => (
          <li key={role.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <RoleName role={role} />
                <span className="text-xs text-muted-foreground">{KIND_LABEL[role.kind]}</span>
              </span>
              <span className="text-xs">
                <PermissionSummary role={role} />
              </span>
              <span className="text-xs">
                <MemberCount role={role} canSeeMembers={canSeeMembers} />
              </span>
            </div>
            <RoleActions role={role} state={stateFor(role)} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </>
  );
}
