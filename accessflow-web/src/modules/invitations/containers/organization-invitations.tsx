"use client";

import { MailPlusIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { mockActionError, setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { ListSkeleton, TableSkeleton } from "@/shared/components/feedback/skeletons";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { apiErrorMessage } from "@/shared/lib/api-errors";
import { pluralize } from "@/shared/lib/format";
import { STATUS_LABELS } from "../components/invitation-status-badge";
import { INVITATION_COLUMNS, OrganizationInvitationList } from "../components/organization-invitation-list";
import { RevokeInvitationDialog } from "../components/revoke-invitation-dialog";
import { useOrganizationInvitations } from "../hooks/use-organization-invitations";
import type { InvitationStatus, OrganizationInvitation } from "../schemas";
import { InviteMemberDialog } from "./invite-member-dialog";

type StatusFilter = InvitationStatus | "ALL";

const STATUS_ITEMS: { label: string; value: StatusFilter }[] = [
  { label: "Pendentes", value: "PENDING" },
  { label: "Expirados", value: "EXPIRED" },
  { label: "Aceitos", value: "ACCEPTED" },
  { label: "Recusados", value: "DECLINED" },
  { label: "Revogados", value: "REVOKED" },
  { label: "Todos os status", value: "ALL" },
];

interface OrganizationInvitationsProps {
  organizationId: string;
  viewerIsOwner: boolean;
}

type DialogState = { kind: "resend" | "revoke"; invitation: OrganizationInvitation; open: boolean } | null;

export function OrganizationInvitations({ organizationId, viewerIsOwner }: OrganizationInvitationsProps) {
  const pathname = usePathname();
  const scenario = useScenario();
  const { invitations, markRevoked } = useOrganizationInvitations(organizationId);
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [dialog, setDialog] = useState<DialogState>(null);

  if (scenario === "loading") {
    return (
      <LoadingRegion label="Carregando convites…" className="flex flex-col gap-4">
        <Skeleton aria-hidden="true" className="h-8 w-full rounded-lg sm:w-44" />
        <TableSkeleton columns={INVITATION_COLUMNS} rows={4} className="hidden md:block" />
        <ListSkeleton rows={3} icon={false} lines={4} trailing="action" className="rounded-lg border px-3 py-3 md:hidden" />
      </LoadingRegion>
    );
  }

  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  const filtered =
    scenario === "empty" ? [] : invitations.filter((invitation) => status === "ALL" || invitation.status === status);
  const closeDialog = () => setDialog((current) => current && { ...current, open: false });

  return (
    <div className="flex flex-col gap-4">
      <Select
        items={STATUS_ITEMS}
        value={status}
        onValueChange={(next) => next && setStatus(next)}
      >
        <SelectTrigger aria-label="Filtrar por status" className="w-full sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {STATUS_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {filtered.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailPlusIcon />
            </EmptyMedia>
            {status === "PENDING" || scenario === "empty" ? (
              <>
                <EmptyTitle>Nenhum convite pendente</EmptyTitle>
                <EmptyDescription>Convide alguém para a organização. O convite vence em 7 dias.</EmptyDescription>
              </>
            ) : (
              <>
                <EmptyTitle>Nenhum convite com este status</EmptyTitle>
                <EmptyDescription>
                  {status === "ALL"
                    ? "A organização ainda não enviou convites."
                    : `Não há convites com o status “${STATUS_LABELS[status]}”.`}
                </EmptyDescription>
              </>
            )}
          </EmptyHeader>
          <EmptyContent>
            <InviteMemberDialog organizationId={organizationId} viewerIsOwner={viewerIsOwner} />
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <OrganizationInvitationList
            invitations={filtered}
            onResend={(invitation) => setDialog({ kind: "resend", invitation, open: true })}
            onRevoke={(invitation) => setDialog({ kind: "revoke", invitation, open: true })}
          />
          <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {pluralize(filtered.length, "convite", "convites")}
          </p>
        </>
      )}

      <InviteMemberDialog
        organizationId={organizationId}
        viewerIsOwner={viewerIsOwner}
        open={dialog?.kind === "resend" && dialog.open}
        onOpenChange={(open) => !open && closeDialog()}
        defaultValues={
          dialog?.kind === "resend"
            ? { email: dialog.invitation.email, roleId: dialog.invitation.assignedRole.id }
            : undefined
        }
      />
      <RevokeInvitationDialog
        open={dialog?.kind === "revoke" && dialog.open}
        invitation={dialog?.kind === "revoke" ? dialog.invitation : null}
        onOpenChange={(open) => !open && closeDialog()}
        onConfirm={(invitation) => {
          closeDialog();
          // Fase 11b: chamar revokeInvitation.
          const code = mockActionError("INVITATION_NOT_FOUND");
          if (code) {
            toast.error("Não foi possível revogar", { description: apiErrorMessage(code) });
            return;
          }
          markRevoked(invitation.id);
          toast.success("Convite revogado", { description: invitation.email });
        }}
      />
    </div>
  );
}
