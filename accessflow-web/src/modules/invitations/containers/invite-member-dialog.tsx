"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon, MailPlusIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
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
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { apiErrorMessage } from "@/shared/lib/api-errors";
import { useOrganizationInvitations } from "../hooks/use-organization-invitations";
import { type InviteMemberForm as InviteMemberValues, inviteMemberFormSchema } from "../schemas";

const FORM_ID = "invite-member";

interface InviteMemberDialogProps {
  organizationId: string;
  viewerIsOwner: boolean;
  /** Com open/onOpenChange, o diálogo é controlado de fora e não tem botão próprio. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Reenviar um convite: começa com o e-mail e o papel dele. */
  defaultValues?: InviteMemberValues;
  /** No cabeçalho, em telas estreitas, o botão fica só com o ícone. */
  compact?: boolean;
  variant?: "default" | "outline";
}

function InviteMemberFormBody({
  organizationId,
  viewerIsOwner,
  defaultValues,
  onDone,
}: Pick<InviteMemberDialogProps, "organizationId" | "viewerIsOwner"> & {
  defaultValues: InviteMemberValues;
  onDone: () => void;
}) {
  const { findRenewable, markInvited } = useOrganizationInvitations(organizationId);
  const [apiError, setApiError] = useState<string | null>(null);
  const form = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberFormSchema),
    defaultValues,
  });
  const email = useWatch({ control: form.control, name: "email" });
  const renewable = findRenewable(email);

  return (
    <OrganizationRoles organizationId={organizationId} viewerIsOwner={viewerIsOwner}>
      {({ roles }) => (
        <form
          id={FORM_ID}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(({ email, roleId }) => {
            const role = roles.find(({ id }) => id === roleId);
            if (!role) return;
            // Fase 11b: chamar inviteMember (a API renova o convite pendente do mesmo e-mail).
            const code = mockActionError("ALREADY_MEMBER");
            if (code) {
              setApiError(apiErrorMessage(code));
              return;
            }
            const normalized = email.trim().toLowerCase();
            const renewing = findRenewable(normalized) !== undefined;
            markInvited({
              email: normalized,
              assignedRole: { id: role.id, name: role.name, kind: role.kind },
              invitedByName: "Você",
            });
            toast.success(renewing ? "Convite renovado" : "Convite enviado", {
              description: `${normalized} tem 7 dias para aceitar.`,
            });
            onDone();
          })}
        >
          {apiError && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>Não foi possível enviar o convite</AlertTitle>
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}
          <FieldGroup>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${FORM_ID}-email`}>E-mail</FieldLabel>
                  <Input
                    {...field}
                    id={`${FORM_ID}-email`}
                    type="email"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="nome@empresa.com.br"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? `${FORM_ID}-email-error` : undefined}
                  />
                  <FieldError id={`${FORM_ID}-email-error`} errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="roleId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${FORM_ID}-role`}>Papel</FieldLabel>
                  <RoleSelect
                    id={`${FORM_ID}-role`}
                    organizationId={organizationId}
                    viewerIsOwner={viewerIsOwner}
                    value={field.value}
                    onValueChange={field.onChange}
                    invalid={fieldState.invalid}
                    aria-describedby={`${FORM_ID}-role-hint`}
                  />
                  <FieldDescription id={`${FORM_ID}-role-hint`}>
                    A pessoa entra com este papel ao aceitar. O convite vence em 7 dias.
                  </FieldDescription>
                </Field>
              )}
            />
          </FieldGroup>
          {renewable && (
            <Alert>
              <InfoIcon />
              <AlertTitle>
                {renewable.status === "EXPIRED" ? "Este e-mail tem um convite vencido" : "Este e-mail já tem um convite pendente"}
              </AlertTitle>
              <AlertDescription>
                Ao enviar, o convite atual é renovado por mais 7 dias e passa a usar o papel escolhido. Não é criado
                um segundo convite.
              </AlertDescription>
            </Alert>
          )}
        </form>
      )}
    </OrganizationRoles>
  );
}

export function InviteMemberDialog({
  organizationId,
  viewerIsOwner,
  open: controlledOpen,
  onOpenChange,
  defaultValues,
  compact = false,
  variant = "default",
}: InviteMemberDialogProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : ownOpen;
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOwnOpen(next));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger render={<Button variant={variant} />}>
          <MailPlusIcon data-icon="inline-start" />
          <span className={compact ? "sr-only sm:not-sr-only" : undefined}>Convidar membro</span>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Reenviar convite" : "Convidar membro"}</DialogTitle>
          <DialogDescription>
            Quem recebe o convite entra com o papel escolhido e pode recusar.
          </DialogDescription>
        </DialogHeader>
        {/* Montado só com o diálogo aberto: cada abertura começa limpa. */}
        {open && (
          <OrganizationRoles organizationId={organizationId} viewerIsOwner={viewerIsOwner}>
            {({ roles }) => (
              <InviteMemberFormBody
                organizationId={organizationId}
                viewerIsOwner={viewerIsOwner}
                defaultValues={
                  defaultValues ?? { email: "", roleId: roles.find(({ kind }) => kind === "MEMBER")?.id ?? "" }
                }
                onDone={() => setOpen(false)}
              />
            )}
          </OrganizationRoles>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button type="submit" form={FORM_ID}>
            {defaultValues ? "Renovar convite" : "Enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
