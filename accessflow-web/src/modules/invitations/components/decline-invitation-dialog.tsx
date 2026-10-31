import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import type { MyInvitation } from "../schemas";

interface DeclineInvitationDialogProps {
  invitation: MyInvitation;
  onConfirm: () => void;
}

export function DeclineInvitationDialog({ invitation, onConfirm }: DeclineInvitationDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" />}>Recusar</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recusar o convite de {invitation.organization.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            O convite deixa de valer. Para entrar depois, você vai precisar de um novo convite de{" "}
            {invitation.invitedByName} ou de outra pessoa da organização.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Manter convite</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Recusar convite
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
