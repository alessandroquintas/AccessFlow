import { CheckIcon, MailIcon } from "lucide-react";
import { RoleBadge } from "@/shared/components/role-badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { LocalDate } from "@/shared/components/local-date";
import type { MyInvitation } from "../schemas";

interface MyInvitationListProps {
  invitations: MyInvitation[];
  onAccept: (invitation: MyInvitation) => void;
  /** O botão de recusar (abre a confirmação). */
  renderDecline: (invitation: MyInvitation) => React.ReactNode;
}

export function MyInvitationList({ invitations, onAccept, renderDecline }: MyInvitationListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {invitations.map((invitation) => (
        <li key={invitation.id}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{invitation.organization.name}</span>
              </CardTitle>
              <CardDescription>
                {invitation.invitedByName} convidou você. Vence{" "}
                <LocalDate iso={invitation.expiresAt} format="relative" />
                .
              </CardDescription>
              <CardAction>
                <RoleBadge {...invitation.assignedRole} />
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-wrap justify-end gap-2">
              {renderDecline(invitation)}
              <Button onClick={() => onAccept(invitation)}>
                <CheckIcon data-icon="inline-start" />
                Aceitar convite
              </Button>
            </CardFooter>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function MyInvitationListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando convites">
      {[0, 1].map((index) => (
        <Skeleton key={index} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}
