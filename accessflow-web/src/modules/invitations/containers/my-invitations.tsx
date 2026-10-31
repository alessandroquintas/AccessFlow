"use client";

import { MailIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { DeclineInvitationDialog } from "../components/decline-invitation-dialog";
import { MyInvitationList, MyInvitationListSkeleton } from "../components/my-invitation-list";
import { useMyInvitations } from "../hooks/use-my-invitations";

export function MyInvitations() {
  const pathname = usePathname();
  const scenario = useScenario();
  const { invitations, markAnswered } = useMyInvitations();

  if (scenario === "loading") return <MyInvitationListSkeleton />;
  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  if (scenario === "empty" || invitations.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MailIcon />
          </EmptyMedia>
          <EmptyTitle>Nenhum convite pendente</EmptyTitle>
          <EmptyDescription>
            Quando alguém convidar você para uma organização, o convite aparece aqui.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" render={<Link href="/organizations" />} nativeButton={false}>
            Ver minhas organizações
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <MyInvitationList
      invitations={invitations}
      onAccept={(invitation) => {
        // Fase 11b: chamar acceptInvitation e atualizar as organizações.
        markAnswered(invitation.id);
        toast.success("Convite aceito", {
          description: `Você agora faz parte de ${invitation.organization.name}.`,
        });
      }}
      renderDecline={(invitation) => (
        <DeclineInvitationDialog
          invitation={invitation}
          onConfirm={() => {
            // Fase 11b: chamar declineInvitation.
            markAnswered(invitation.id);
            toast("Convite recusado", { description: invitation.organization.name });
          }}
        />
      )}
    />
  );
}
