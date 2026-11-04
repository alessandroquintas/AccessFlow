"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  type CreatePermissionForm,
  createPermissionFormSchema,
  type EditPermissionForm,
  editPermissionFormSchema,
  MAX_PERMISSION_DESCRIPTION,
  type PermissionDefinition,
} from "../schemas";

/** Descrição com contador (o limite da API é 200). */
function DescriptionField({
  id,
  value,
  error,
  field,
}: {
  id: string;
  value: string;
  error?: { message?: string };
  field: React.ComponentProps<typeof Textarea>;
}) {
  const over = value.length > MAX_PERMISSION_DESCRIPTION;
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>Descrição</FieldLabel>
      <Textarea
        {...field}
        id={id}
        rows={3}
        placeholder="Ex.: Aprovar faturas de fornecedores…"
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-count${error ? ` ${id}-error` : ""}`}
      />
      <div className="flex items-start justify-between gap-3">
        {error ? <FieldError id={`${id}-error`} errors={[error]} /> : <FieldDescription>O que a permissão autoriza, como aparece nos papéis.</FieldDescription>}
        <FieldDescription id={`${id}-count`} className={over ? "shrink-0 text-destructive tabular-nums" : "shrink-0 tabular-nums"}>
          {value.length}/{MAX_PERMISSION_DESCRIPTION}
        </FieldDescription>
      </div>
    </Field>
  );
}

interface CreatePermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chaves que já existem no catálogo (a API recusaria com PERMISSION_KEY_TAKEN). */
  existingKeys: string[];
  apiError: string | null;
  onSubmit: (values: CreatePermissionForm) => void;
}

function CreatePermissionForm({ existingKeys, apiError, onSubmit }: Omit<CreatePermissionDialogProps, "open" | "onOpenChange">) {
  const form = useForm<CreatePermissionForm>({
    resolver: zodResolver(createPermissionFormSchema),
    defaultValues: { key: "", description: "" },
    // Validação ao digitar.
    mode: "onChange",
  });
  const key = useWatch({ control: form.control, name: "key" });
  const description = useWatch({ control: form.control, name: "description" });
  const keyValid = key !== "" && !form.formState.errors.key;

  return (
    <form
      id="create-permission"
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((values) => {
        if (existingKeys.includes(values.key)) {
          form.setError("key", { message: "Já existe uma permissão com essa chave. Escolha outra chave." });
          return;
        }
        onSubmit(values);
      })}
    >
      {apiError && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Não foi possível criar a permissão</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Controller
          name="key"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="permission-key">Chave</FieldLabel>
              <Input
                {...field}
                id="permission-key"
                className="font-mono"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="faturas:aprovar"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? "permission-key-error" : "permission-key-hint"}
              />
              {fieldState.error ? (
                <FieldError id="permission-key-error" errors={[fieldState.error]} />
              ) : (
                <FieldDescription id="permission-key-hint">
                  recurso:ação, com letras minúsculas, dígitos e hífen, começando por letra; até 40 caracteres de cada
                  lado. Não muda depois de criada.
                </FieldDescription>
              )}
              <div className="flex min-h-6 flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                Prévia:{" "}
                {keyValid ? <PermissionKeyTag value={key} /> : <span>a chave aparece aqui quando estiver válida</span>}
              </div>
            </Field>
          )}
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <DescriptionField id="permission-description" value={description} error={fieldState.error} field={field} />
          )}
        />
      </FieldGroup>
      <Alert>
        <InfoIcon />
        <AlertTitle>Ninguém recebe esta permissão automaticamente, exceto o OWNER</AlertTitle>
        <AlertDescription>Depois de criar, inclua a permissão nos papéis que devem tê-la.</AlertDescription>
      </Alert>
    </form>
  );
}

export function CreatePermissionDialog({ open, onOpenChange, ...props }: CreatePermissionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar permissão</DialogTitle>
          <DialogDescription>Uma chave nova que os papéis podem conceder e as integrações podem consultar.</DialogDescription>
        </DialogHeader>
        {/* Montado só com o diálogo aberto: cada abertura começa limpa. */}
        {open && <CreatePermissionForm {...props} />}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button type="submit" form="create-permission">
            Criar permissão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditPermissionDialogProps {
  open: boolean;
  permission: PermissionDefinition | null;
  apiError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: EditPermissionForm) => void;
}

function EditPermissionForm({
  permission,
  apiError,
  onSubmit,
}: { permission: PermissionDefinition } & Pick<EditPermissionDialogProps, "apiError" | "onSubmit">) {
  const form = useForm<EditPermissionForm>({
    resolver: zodResolver(editPermissionFormSchema),
    defaultValues: { description: permission.description },
    mode: "onChange",
  });
  const description = useWatch({ control: form.control, name: "description" });

  return (
    <form id="edit-permission" noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      {apiError && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Field>
          <FieldLabel>Chave</FieldLabel>
          <div>
            <PermissionKeyTag value={permission.key} />
          </div>
          <FieldDescription>
            A chave não muda: integrações e papéis podem depender dela. Para outra chave, crie uma permissão nova.
          </FieldDescription>
        </Field>
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <DescriptionField id="edit-permission-description" value={description} error={fieldState.error} field={field} />
          )}
        />
      </FieldGroup>
    </form>
  );
}

export function EditPermissionDialog({ open, permission, apiError, onOpenChange, onSubmit }: EditPermissionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar permissão</DialogTitle>
          <DialogDescription>Só a descrição pode mudar.</DialogDescription>
        </DialogHeader>
        {open && permission && (
          <EditPermissionForm key={permission.key} permission={permission} apiError={apiError} onSubmit={onSubmit} />
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button type="submit" form="edit-permission">
            Salvar descrição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
