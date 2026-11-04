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
import type { Member } from "../schemas";

interface ConfirmProps {
  open: boolean;
  /** Fica preenchido enquanto o diálogo fecha, para o texto não sumir na animação. */
  member: Member | null;
  organizationName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (member: Member) => void;
}

export function RemoveMemberDialog({ open, member, organizationName, onOpenChange, onConfirm }: ConfirmProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover {member?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {member?.name} perde o acesso a {organizationName} imediatamente, inclusive às integrações que
            consultam as permissões dele. Para voltar, precisará de um novo convite.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Manter membro</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => member && onConfirm(member)}>
            Remover da organização
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function LeaveOrganizationDialog({ open, member, organizationName, onOpenChange, onConfirm }: ConfirmProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sair de {organizationName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Você perde o acesso a esta organização imediatamente. Para voltar, precisará de um novo convite.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar na organização</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => member && onConfirm(member)}>
            Sair da organização
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
