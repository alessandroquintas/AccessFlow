"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { mockActionError, setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { ChecklistSkeleton, FormSkeleton, ListSkeleton } from "@/shared/components/feedback/skeletons";
import { UnsavedChangesGuard } from "@/shared/components/feedback/unsaved-changes-guard";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { apiErrorMessage } from "@/shared/lib/api-errors";
import { PermissionChecklist } from "../components/permission-checklist";
import { useOrganizationCatalog } from "../hooks/use-organization-catalog";
import { useOrganizationRoles } from "../hooks/use-organization-roles";
import { usePermissions } from "../hooks/use-permissions";
import { diffPermissions, formatDiff, permissionLock } from "../lib/role-editor";
import { type OrganizationRole, type RoleForm, roleFormSchema } from "../schemas";

interface RoleEditorProps {
  organizationId: string;
  organizationName: string;
  viewerIsOwner: boolean;
  /** null: criar um papel (/roles/new). */
  roleId: string | null;
  /** Os membros com o papel (vem do módulo de membros). */
  renderMembers?: (role: OrganizationRole) => React.ReactNode;
}

const normalizeName = (name: string) => name.normalize("NFC").trim().replace(/\s+/g, " ");

function Tags({ keys, sign }: { keys: string[]; sign: "+" | "−" }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={sign === "+" ? "Adicionadas" : "Removidas"}>
      {keys.map((key) => (
        <li key={key} className="flex items-center gap-1">
          <span aria-hidden="true" className={sign === "+" ? "text-success" : "text-destructive"}>
            {sign}
          </span>
          <PermissionKeyTag value={key} />
        </li>
      ))}
    </ul>
  );
}

function RoleEditorForm({
  organizationId,
  viewerIsOwner,
  role,
  renderMembers,
}: Omit<RoleEditorProps, "roleId" | "organizationName"> & { role: OrganizationRole | null }) {
  const router = useRouter();
  const { roles, saveRole, can } = useOrganizationRoles(organizationId, viewerIsOwner);
  const { system, custom } = useOrganizationCatalog(organizationId);
  const { permissions: viewerPermissions } = usePermissions(organizationId);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const original = { name: role?.name ?? "", permissions: role?.permissions ?? [] };
  const form = useForm<RoleForm>({ resolver: zodResolver(roleFormSchema), defaultValues: original });
  const name = useWatch({ control: form.control, name: "name" });
  const selected = useWatch({ control: form.control, name: "permissions" });

  const kind = role?.kind ?? "CUSTOM";
  const canManage = can("roles:manage");
  const readOnly = kind === "OWNER" || !canManage;
  const nameLocked = readOnly || kind !== "CUSTOM";
  const lockOf = (key: string) => permissionLock(key, { roleKind: kind, canManage, viewerPermissions });

  const formDefaults = form.formState.defaultValues;
  const before = (formDefaults?.permissions ?? []).filter((key): key is string => typeof key === "string");
  const diff = diffPermissions(before, selected);
  const nameChanged = normalizeName(name) !== normalizeName(formDefaults?.name ?? "");
  const dirty = !readOnly && (nameChanged || diff.added.length > 0 || diff.removed.length > 0);

  const save = () => {
    const values = roleFormSchema.parse(form.getValues());
    setSummaryOpen(false);
    // Fase 11b: chamar createRole ou updateRole. Cada tentativa com o erro simulado mostra um código.
    const code = role
      ? mockActionError("PRIVILEGE_ESCALATION", "ROLE_NAME_TAKEN", "SYSTEM_ROLE_IMMUTABLE")
      : mockActionError("ROLE_LIMIT_REACHED", "ROLE_NAME_TAKEN", "PRIVILEGE_ESCALATION");
    if (code) {
      setApiError(apiErrorMessage(code));
      return;
    }
    setApiError(null);
    const saved: OrganizationRole = role
      ? { ...role, name: values.name, permissions: values.permissions }
      : {
          id: `role-${crypto.randomUUID()}`,
          name: values.name,
          kind: "CUSTOM",
          permissions: values.permissions,
          memberCount: 0,
          pendingInvitationCount: 0,
        };
    saveRole(saved);
    form.reset({ name: values.name, permissions: values.permissions });
    if (role) {
      toast.success("Alterações salvas", { description: `${values.name}: ${formatDiff(diff)}` });
    } else {
      toast.success("Papel criado", { description: values.name });
      router.push(`/roles/${saved.id}`);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((values) => {
        // Mesmo nome que outro papel (sem diferenciar maiúsculas): a API recusaria com ROLE_NAME_TAKEN.
        const taken = roles.some(
          (other) => other.id !== role?.id && other.name.toLowerCase() === values.name.toLowerCase(),
        );
        if (taken) {
          form.setError("name", { message: "Já existe um papel com esse nome. Escolha outro nome." });
          return;
        }
        setSummaryOpen(true);
      })}
    >
      <UnsavedChangesGuard when={dirty} />

      {kind === "OWNER" && (
        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>O OWNER tem todas as permissões</AlertTitle>
          <AlertDescription>
            Inclusive as personalizadas, também as criadas depois. O papel não muda: para dar menos acesso a
            alguém, troque o papel dessa pessoa.
          </AlertDescription>
        </Alert>
      )}
      {kind !== "OWNER" && !canManage && (
        <Alert>
          <EyeIcon />
          <AlertTitle>Modo de leitura</AlertTitle>
          <AlertDescription>
            <p>
              Você pode ver este papel, mas editar papéis exige a permissão <PermissionKeyTag value="roles:manage" />.
            </p>
          </AlertDescription>
        </Alert>
      )}
      {apiError && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Não foi possível salvar o papel</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Nome</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Controller
                  name="name"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="role-name" className="sr-only">
                        Nome do papel
                      </FieldLabel>
                      <Input
                        {...field}
                        id="role-name"
                        readOnly={nameLocked}
                        placeholder="Ex.: Financeiro…"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={fieldState.error ? "role-name-error" : "role-name-hint"}
                      />
                      {fieldState.error ? (
                        <FieldError id="role-name-error" errors={[fieldState.error]} />
                      ) : (
                        <FieldDescription id="role-name-hint">
                          {kind !== "CUSTOM"
                            ? "Papéis de sistema mantêm o nome: o OWNER e o MEMBER existem em toda organização."
                            : nameLocked
                              ? "Até 50 caracteres."
                              : "Obrigatório, até 50 caracteres. Não pode repetir o nome de outro papel."}
                        </FieldDescription>
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Permissões</h2>
              </CardTitle>
              <CardDescription>
                {kind === "OWNER"
                  ? "Todas marcadas e travadas."
                  : readOnly
                    ? `${selected.length} de ${system.length + custom.length} permissões.`
                    : "Quem tiver o papel pode fazer o que estiver marcado. As travadas você não pode conceder nem retirar."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionChecklist
                catalog={[...system, ...custom]}
                selected={selected}
                lockOf={lockOf}
                onChange={(next) => form.setValue("permissions", next, { shouldDirty: true })}
              />
            </CardContent>
          </Card>
        </div>

        {role && renderMembers && <div className="min-w-0 lg:sticky lg:top-20">{renderMembers(role)}</div>}
      </div>

      {!readOnly && (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {dirty ? (
              <>
                Alterações nas permissões: <span className="font-medium text-foreground tabular-nums">{formatDiff(diff)}</span>
                {nameChanged && " e no nome"}
              </>
            ) : (
              "Nenhuma alteração."
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/roles" />} nativeButton={false}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!dirty}>
              {role ? "Salvar papel" : "Criar papel"}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{role ? `Salvar as alterações em ${normalizeName(name)}?` : `Criar o papel ${normalizeName(name)}?`}</DialogTitle>
            <DialogDescription>
              {role
                ? `As permissões mudam na hora para ${role.memberCount === 1 ? "o membro" : `os ${role.memberCount} membros`} com este papel, inclusive nas integrações.`
                : "Ninguém recebe o papel ao criá-lo: depois, troque o papel dos membros ou convide alguém com ele."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 text-sm">
            {role && nameChanged && (
              <p>
                Nome: <span className="text-muted-foreground line-through">{formDefaults?.name}</span> →{" "}
                <span className="font-medium">{normalizeName(name)}</span>
              </p>
            )}
            <p className="flex items-center gap-2 font-medium">
              Permissões <Badge variant="outline" className="tabular-nums">{formatDiff(diff)}</Badge>
            </p>
            {diff.added.length > 0 && <Tags keys={diff.added} sign="+" />}
            {diff.removed.length > 0 && <Tags keys={diff.removed} sign="−" />}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Voltar à edição</DialogClose>
            <Button onClick={save}>{role ? "Salvar papel" : "Criar papel"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

export function RoleEditor({ organizationId, organizationName, viewerIsOwner, roleId, renderMembers }: RoleEditorProps) {
  const pathname = usePathname();
  const scenario = useScenario();
  const { roles } = useOrganizationRoles(organizationId, viewerIsOwner);
  const role = roleId ? roles.find(({ id }) => id === roleId) : null;
  const loading = scenario === "loading";
  const title = role ? role.name : roleId ? "Papel não encontrado" : "Novo papel";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: organizationName, href: "/overview" },
          { label: "Papéis", href: "/roles" },
          { label: title },
        ]}
        title={title}
        meta={
          // O título já é o nome do papel: o badge diz o tipo.
          role ? <Badge variant="outline">{role.kind === "CUSTOM" ? "Personalizado" : "Sistema"}</Badge> : undefined
        }
        description={role ? undefined : roleId ? undefined : "Dê um nome e escolha o que quem tiver o papel pode fazer."}
        loading={loading}
      />
      <PageBody>
        {loading ? (
          <LoadingRegion label="Carregando papel…" className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex flex-col gap-6">
              <Card aria-hidden="true">
                <CardContent>
                  <FormSkeleton fields={1} submit={false} />
                </CardContent>
              </Card>
              <Card aria-hidden="true">
                <CardContent>
                  <ChecklistSkeleton />
                </CardContent>
              </Card>
            </div>
            <Card aria-hidden="true">
              <CardContent>
                <ListSkeleton rows={4} />
              </CardContent>
            </Card>
          </LoadingRegion>
        ) : scenario === "error" ? (
          <ErrorState onRetry={() => setScenario("normal", pathname)} />
        ) : roleId && !role ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldCheckIcon />
              </EmptyMedia>
              <EmptyTitle>Este papel não existe mais</EmptyTitle>
              <EmptyDescription>Ele pode ter sido excluído. Confira a lista de papéis da organização.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button render={<Link href="/roles" />} nativeButton={false}>
                Ver papéis
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <RoleEditorForm
            // Recomeça o formulário ao trocar de papel ou de organização.
            key={`${organizationId}:${roleId ?? "new"}`}
            organizationId={organizationId}
            viewerIsOwner={viewerIsOwner}
            role={role ?? null}
            renderMembers={renderMembers}
          />
        )}
      </PageBody>
    </>
  );
}
