"use client";

import { SearchIcon, UsersIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { mockActionError, setScenario, useScenario } from "@/infra/mocks/scenario";
import { GRANT_BLOCK_TEXT, OrganizationRoles } from "@/modules/access-control/containers/organization-roles";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { FilterBarSkeleton, ListSkeleton, TableSkeleton } from "@/shared/components/feedback/skeletons";
import { Button } from "@/shared/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { apiErrorMessage } from "@/shared/lib/api-errors";
import { pluralize } from "@/shared/lib/format";
import { LeaveOrganizationDialog, RemoveMemberDialog } from "../components/member-confirm-dialogs";
import { MEMBER_COLUMNS, MemberList } from "../components/member-list";
import type { MemberRowActions } from "../components/member-actions-menu";
import { useMembers } from "../hooks/use-members";
import { filterMembers, isLastOwner } from "../lib/members";
import type { Member, MemberFilters } from "../schemas";
import { ChangeRoleDialog } from "./change-role-dialog";

/** Do tamanho de uma página do `organizationMembers` (Fase 11b: `first`/`after`). */
const PAGE_SIZE = 15;

const LAST_OWNER_TEXT = "É preciso haver outro OWNER antes.";

interface MembersListProps {
  organizationId: string;
  organizationName: string;
  viewerIsOwner: boolean;
  /** O botão de convidar, quando o viewer pode (vem do módulo de convites). */
  inviteAction?: React.ReactNode;
}

type DialogState = { kind: "role" | "remove" | "leave"; member: Member; open: boolean } | null;

export function MembersList({ organizationId, organizationName, viewerIsOwner, inviteAction }: MembersListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const scenario = useScenario();
  const { members, viewerUserId, markRemoved, markRoleChanged } = useMembers(organizationId);
  const [filters, setFilters] = useState<MemberFilters>({ query: "", roleId: null });
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [dialog, setDialog] = useState<DialogState>(null);

  if (scenario === "loading") {
    return (
      <LoadingRegion label="Carregando membros…" className="flex flex-col gap-4">
        <FilterBarSkeleton />
        <TableSkeleton columns={MEMBER_COLUMNS} rows={8} className="hidden md:block" />
        <ListSkeleton
          rows={6}
          icon={false}
          lines={3}
          trailing="action"
          className="rounded-lg border px-3 py-3 md:hidden"
        />
      </LoadingRegion>
    );
  }

  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  if (scenario === "empty") {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon />
          </EmptyMedia>
          <EmptyTitle>Só você por aqui</EmptyTitle>
          <EmptyDescription>Convide alguém para a organização. O convite vence em 7 dias.</EmptyDescription>
        </EmptyHeader>
        {inviteAction && <EmptyContent>{inviteAction}</EmptyContent>}
      </Empty>
    );
  }

  const changeFilters = (next: Partial<MemberFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setVisible(PAGE_SIZE);
  };

  const filtered = filterMembers(members, filters);
  const shown = filtered.slice(0, visible);
  const closeDialog = () => setDialog((current) => current && { ...current, open: false });

  return (
    <OrganizationRoles organizationId={organizationId} viewerIsOwner={viewerIsOwner}>
      {({ roles, grantBlock, can }) => {
        const roleItems = [
          { label: "Todos os papéis", value: null },
          ...roles.map((role) => ({ label: role.name, value: role.id })),
        ];

        const actionsFor = (member: Member): MemberRowActions => {
          const isViewer = member.userId === viewerUserId;
          const currentRole = roles.find(({ id }) => id === member.role.id);
          const block = currentRole ? grantBlock(currentRole) : null;
          const lastOwner = isLastOwner(members, member.userId);

          if (isViewer) {
            return {
              changeRole: can("roles:assign")
                ? { blocked: lastOwner ? LAST_OWNER_TEXT : block ? GRANT_BLOCK_TEXT[block] : undefined }
                : undefined,
              leave: { blocked: lastOwner ? LAST_OWNER_TEXT : undefined },
            };
          }
          return {
            changeRole: can("roles:assign")
              ? {
                  blocked:
                    block === "owner-only"
                      ? "Só um OWNER pode mudar o papel de um OWNER."
                      : block
                        ? "O papel atual tem permissões que você não tem."
                        : undefined,
                }
              : undefined,
            remove: can("members:remove") ? true : undefined,
          };
        };

        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <InputGroup className="sm:max-w-xs">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  aria-label="Buscar por nome ou e-mail"
                  placeholder="Buscar por nome ou e-mail"
                  value={filters.query}
                  onChange={(event) => changeFilters({ query: event.target.value })}
                />
              </InputGroup>
              <Select
                items={roleItems}
                value={filters.roleId}
                onValueChange={(roleId) => changeFilters({ roleId })}
              >
                <SelectTrigger aria-label="Filtrar por papel" className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {roleItems.map((item) => (
                      <SelectItem key={item.label} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {filtered.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum membro encontrado</EmptyTitle>
                  <EmptyDescription>Confira a busca ou escolha outro papel no filtro.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => changeFilters({ query: "", roleId: null })}>
                    Limpar filtros
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <>
                <MemberList
                  members={shown}
                  viewerUserId={viewerUserId}
                  actionsFor={actionsFor}
                  onChangeRole={(member) => setDialog({ kind: "role", member, open: true })}
                  onRemove={(member) => setDialog({ kind: "remove", member, open: true })}
                  onLeave={(member) => setDialog({ kind: "leave", member, open: true })}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                    Mostrando {shown.length} de {pluralize(filtered.length, "membro", "membros")}
                  </p>
                  {shown.length < filtered.length && (
                    <Button variant="outline" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
                      Carregar mais
                    </Button>
                  )}
                </div>
              </>
            )}

            <ChangeRoleDialog
              open={dialog?.kind === "role" && dialog.open}
              member={dialog?.kind === "role" ? dialog.member : null}
              organizationId={organizationId}
              viewerIsOwner={viewerIsOwner}
              isViewer={dialog?.member.userId === viewerUserId}
              onOpenChange={(open) => !open && closeDialog()}
              onChanged={(member, role) => {
                markRoleChanged(member.userId, role);
                closeDialog();
                toast.success("Papel trocado", { description: `${member.name} agora é ${role.name}.` });
              }}
            />
            <RemoveMemberDialog
              open={dialog?.kind === "remove" && dialog.open}
              member={dialog?.kind === "remove" ? dialog.member : null}
              organizationName={organizationName}
              onOpenChange={(open) => !open && closeDialog()}
              onConfirm={(member) => {
                closeDialog();
                // Fase 11b: chamar removeMember.
                const code = mockActionError("MEMBER_NOT_FOUND");
                if (code) {
                  toast.error("Não foi possível remover", { description: apiErrorMessage(code) });
                  return;
                }
                markRemoved(member.userId);
                toast.success("Membro removido", { description: `${member.name} não tem mais acesso.` });
              }}
            />
            <LeaveOrganizationDialog
              open={dialog?.kind === "leave" && dialog.open}
              member={dialog?.kind === "leave" ? dialog.member : null}
              organizationName={organizationName}
              onOpenChange={(open) => !open && closeDialog()}
              onConfirm={() => {
                closeDialog();
                // Fase 11b: chamar leaveOrganization, atualizar as organizações e trocar a ativa.
                const code = mockActionError("LAST_OWNER");
                if (code) {
                  toast.error("Não foi possível sair", { description: apiErrorMessage(code) });
                  return;
                }
                toast.success("Você saiu da organização", { description: organizationName });
                router.push("/organizations");
              }}
            />
          </div>
        );
      }}
    </OrganizationRoles>
  );
}
