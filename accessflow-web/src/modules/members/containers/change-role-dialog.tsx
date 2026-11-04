"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { mockActionError } from "@/infra/mocks/scenario";
import { OrganizationRoles } from "@/modules/access-control/containers/organization-roles";
import { RoleSelect } from "@/modules/access-control/containers/role-select";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/shared/components/ui/field";
import { apiErrorMessage } from "@/shared/lib/api-errors";
import type { Member, MemberRole } from "../schemas";

interface ChangeRoleDialogProps {
  open: boolean;
  member: Member | null;
  organizationId: string;
  viewerIsOwner: boolean;
  isViewer: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (member: Member, role: MemberRole) => void;
}

function ChangeRoleForm({
  member,
  organizationId,
  viewerIsOwner,
  isViewer,
  onChanged,
}: Omit<ChangeRoleDialogProps, "open" | "onOpenChange" | "member"> & { member: Member }) {
  const [roleId, setRoleId] = useState(member.role.id);
  const [error, setError] = useState<string | null>(null);

  return (
    <OrganizationRoles organizationId={organizationId} viewerIsOwner={viewerIsOwner}>
      {({ roles }) => (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const role = roles.find(({ id }) => id === roleId);
            if (!role) return;
            // Fase 11b: chamar assignRole.
            const code = mockActionError("PRIVILEGE_ESCALATION");
            if (code) {
              setError(apiErrorMessage(code));
              return;
            }
            onChanged(member, { id: role.id, name: role.name, kind: role.kind });
          }}
        >
          {error && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>Não foi possível trocar o papel</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="change-role">Papel</FieldLabel>
              <RoleSelect
                id="change-role"
                organizationId={organizationId}
                viewerIsOwner={viewerIsOwner}
                value={roleId}
                onValueChange={setRoleId}
                aria-describedby="change-role-hint"
              />
              <FieldDescription id="change-role-hint">
                {isViewer
                  ? "Você passa a ter só as permissões do novo papel, e talvez não consiga desfazer a troca."
                  : "As permissões mudam na hora, inclusive nas integrações que consultam o acesso."}
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={roleId === member.role.id}>
              Trocar papel
            </Button>
          </DialogFooter>
        </form>
      )}
    </OrganizationRoles>
  );
}

export function ChangeRoleDialog({ open, member, onOpenChange, ...props }: ChangeRoleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.isViewer ? "Trocar o seu papel" : `Trocar o papel de ${member?.name}`}</DialogTitle>
          <DialogDescription>
            Papel atual: {member?.role.name}.
          </DialogDescription>
        </DialogHeader>
        {/* Montado só com o diálogo aberto: cada abertura começa do papel atual. */}
        {open && member && <ChangeRoleForm key={member.userId} member={member} {...props} />}
      </DialogContent>
    </Dialog>
  );
}
