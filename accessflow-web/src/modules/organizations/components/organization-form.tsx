"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { InputGroup, InputGroupInput } from "@/shared/components/ui/input-group";
import { slugify } from "@/shared/lib/slugify";
import { type OrganizationForm as OrganizationFormValues, organizationFormSchema } from "../schemas";

interface OrganizationFormProps {
  id: string;
  onSubmit: (values: OrganizationFormValues) => Promise<void> | void;
}

/**
 * Nome e identificador. O identificador é sugerido a partir do nome até a
 * pessoa editá-lo; daí em diante, fica como ela escreveu.
 */
export function OrganizationForm({ id, onSubmit }: OrganizationFormProps) {
  const [slugEdited, setSlugEdited] = useState(false);
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: "", slug: "" },
  });

  return (
    <form id={id} onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${id}-name`}>Nome</FieldLabel>
              <Input
                {...field}
                id={`${id}-name`}
                autoComplete="organization"
                placeholder="Cooperativa Vale Verde"
                aria-invalid={fieldState.invalid}
                onChange={(event) => {
                  field.onChange(event);
                  if (!slugEdited) {
                    form.setValue("slug", slugify(event.target.value), {
                      shouldValidate: form.formState.isSubmitted,
                    });
                  }
                }}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="slug"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${id}-slug`}>Identificador</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  {...field}
                  id={`${id}-slug`}
                  className="font-mono"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={`${id}-slug-hint`}
                  onChange={(event) => {
                    setSlugEdited(true);
                    field.onChange(event.target.value.toLowerCase());
                  }}
                />
              </InputGroup>
              {fieldState.error ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <FieldDescription id={`${id}-slug-hint`}>
                  Identifica a organização nas integrações. Letras minúsculas, números e hífens.
                </FieldDescription>
              )}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  );
}
