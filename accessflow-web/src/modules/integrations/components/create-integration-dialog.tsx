"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LockIcon, TriangleAlertIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { ScopeTag } from "@/shared/components/scope-tag";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { missingForScope, SCOPE_INFO } from "../lib/scopes";
import { type CreateIntegrationForm, createIntegrationFormSchema, INTEGRATION_SCOPES } from "../schemas";

const FORM_ID = "create-integration";

interface CreateIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewerPermissions: readonly string[];
  apiError: string | null;
  onSubmit: (values: CreateIntegrationForm) => void;
}

/** Os escopos com o motivo do cadeado; também usado na /design. */
export function ScopeChecklist({
  value,
  onChange,
  viewerPermissions,
  invalid,
  idPrefix = "scope",
}: {
  /** Ids únicos quando há mais de uma lista na página (a /design). */
  idPrefix?: string;
  value: string[];
  onChange: (next: CreateIntegrationForm["scopes"]) => void;
  viewerPermissions: readonly string[];
  invalid?: boolean;
}) {
  return (
    <>
      {INTEGRATION_SCOPES.map((scope) => {
        const missing = missingForScope(scope, viewerPermissions);
        const locked = missing.length > 0;
        const id = `${idPrefix}-${scope.replace("/", "-")}`;
        return (
          <Field key={scope} orientation="horizontal" data-disabled={locked || undefined}>
            <Checkbox
              id={id}
              checked={value.includes(scope)}
              disabled={locked}
              aria-invalid={invalid}
              onCheckedChange={(checked) =>
                onChange(
                  INTEGRATION_SCOPES.filter((item) => (item === scope ? checked : value.includes(item))),
                )
              }
            />
            <FieldContent>
              <FieldLabel htmlFor={id}>
                <ScopeTag value={scope} />
                {locked && <LockIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />}
              </FieldLabel>
              <FieldDescription>
                {SCOPE_INFO[scope].description}.
                {locked && (
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    Exige {missing.map((key) => <PermissionKeyTag key={key} value={key} />)}, que você não tem, então
                    não pode concedê-lo.
                  </span>
                )}
              </FieldDescription>
            </FieldContent>
          </Field>
        );
      })}
    </>
  );
}

function CreateIntegrationFormBody({ viewerPermissions, apiError, onSubmit }: Omit<CreateIntegrationDialogProps, "open" | "onOpenChange">) {
  const form = useForm<CreateIntegrationForm>({
    resolver: zodResolver(createIntegrationFormSchema),
    defaultValues: { name: "", scopes: [] },
  });

  return (
    <form id={FORM_ID} noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      {apiError && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Não foi possível criar a integração</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${FORM_ID}-name`}>Nome</FieldLabel>
              <Input
                {...field}
                id={`${FORM_ID}-name`}
                autoComplete="off"
                placeholder="Ex.: ERP Financeiro…"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? `${FORM_ID}-name-error` : `${FORM_ID}-name-hint`}
              />
              {fieldState.error ? (
                <FieldError id={`${FORM_ID}-name-error`} errors={[fieldState.error]} />
              ) : (
                <FieldDescription id={`${FORM_ID}-name-hint`}>
                  O sistema que vai consultar o AccessFlow. De 2 a 60 caracteres.
                </FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          name="scopes"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid}>
              <FieldLegend variant="label">Escopos</FieldLegend>
              <FieldDescription>O que a integração pode perguntar à API do AccessFlow.</FieldDescription>
              <ScopeChecklist
                value={field.value}
                onChange={field.onChange}
                viewerPermissions={viewerPermissions}
                invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </FieldSet>
          )}
        />
      </FieldGroup>
    </form>
  );
}

export function CreateIntegrationDialog({ open, onOpenChange, ...props }: CreateIntegrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar integração</DialogTitle>
          <DialogDescription>
            Ao criar, você recebe um client_id e um client_secret para o sistema obter tokens. O segredo aparece uma
            única vez.
          </DialogDescription>
        </DialogHeader>
        {/* Montado só com o diálogo aberto: cada abertura começa limpa. */}
        {open && <CreateIntegrationFormBody {...props} />}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button type="submit" form={FORM_ID}>
            Criar integração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
