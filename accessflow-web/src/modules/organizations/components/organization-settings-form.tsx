"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { type OrganizationSettingsForm as SettingsValues, organizationSettingsFormSchema } from "../schemas";

interface OrganizationSettingsFormProps {
  name: string;
  slug: string;
  /** true quando salvou: o formulário passa a considerar o novo nome como o salvo. */
  onSubmit: (values: SettingsValues) => boolean;
}

/** Nome editável e identificador somente leitura (não muda depois de criado). */
export function OrganizationSettingsForm({ name, slug, onSubmit }: OrganizationSettingsFormProps) {
  const form = useForm<SettingsValues>({
    resolver: zodResolver(organizationSettingsFormSchema),
    defaultValues: { name },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((values) => {
        if (onSubmit(values)) form.reset(values);
      })}
    >
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="settings-name">Nome</FieldLabel>
              <Input
                {...field}
                id="settings-name"
                autoComplete="organization"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? "settings-name-error" : "settings-name-hint"}
              />
              {fieldState.error ? (
                <FieldError id="settings-name-error" errors={[fieldState.error]} />
              ) : (
                <FieldDescription id="settings-name-hint">
                  De 2 a 100 caracteres. Aparece para os membros e nos convites.
                </FieldDescription>
              )}
            </Field>
          )}
        />
        <Field>
          <FieldLabel htmlFor="settings-slug">Identificador</FieldLabel>
          <Input id="settings-slug" value={slug} readOnly className="font-mono" aria-describedby="settings-slug-hint" />
          <FieldDescription id="settings-slug-hint">
            Definido na criação e não muda: as integrações usam o identificador para encontrar a organização.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" className="self-start" disabled={!form.formState.isDirty}>
        Salvar alterações
      </Button>
    </form>
  );
}
