import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import type { OrganizationInvitation } from "../schemas";

interface RevokeInvitationDialogProps {
  open: boolean;
  /** Fica preenchido enquanto o diálogo fecha, para o texto não sumir na animação. */
  invitation: OrganizationInvitation | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (invitation: OrganizationInvitation) => void;
}

export function RevokeInvitationDialog({ open, invitation, onOpenChange, onConfirm }: RevokeInvitationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revogar o convite de {invitation?.email}?</AlertDialogTitle>
          <AlertDialogDescription>
            O link do convite deixa de funcionar imediatamente. Para essa pessoa entrar depois, será preciso
            enviar um novo convite.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Manter convite</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => invitation && onConfirm(invitation)}>
            Revogar convite
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
