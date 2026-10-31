"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Spinner } from "@/shared/components/ui/spinner";
import { type ProfileForm, profileFormSchema } from "../schemas";

interface ProfileNameFormProps {
  email: string;
  defaultName?: string;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (values: ProfileForm) => Promise<void> | void;
}

/** Nome editável e e-mail somente leitura (vem do login). */
export function ProfileNameForm({
  email,
  defaultName = "",
  submitLabel,
  submittingLabel,
  onSubmit,
}: ProfileNameFormProps) {
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: defaultName },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="profile-name">Nome</FieldLabel>
              <Input
                {...field}
                id="profile-name"
                autoComplete="name"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? "profile-name-error" : "profile-name-hint"}
              />
              {fieldState.error ? (
                <FieldError id="profile-name-error" errors={[fieldState.error]} />
              ) : (
                <FieldDescription id="profile-name-hint">
                  Aparece para as pessoas das organizações de que você participa.
                </FieldDescription>
              )}
            </Field>
          )}
        />
        <Field>
          <FieldLabel htmlFor="profile-email">E-mail</FieldLabel>
          <Input id="profile-email" value={email} readOnly aria-describedby="profile-email-hint" />
          <FieldDescription id="profile-email-hint">
            Vem da sua conta de login e não pode ser alterado aqui.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
        {form.formState.isSubmitting ? submittingLabel : submitLabel}
      </Button>
    </form>
  );
}
