"use client";

import {
  CableIcon,
  CopyIcon,
  LockIcon,
  MailPlusIcon,
  MoreHorizontalIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import { getPersona, sessionStore } from "@/infra/mocks/personas";
import { useStore } from "@/infra/mocks/use-store";
import { Can } from "@/modules/access-control/containers/can";
import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { ViewerPermissions } from "@/modules/access-control/containers/viewer-permissions";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { Suspense } from "react";
import { DevToolbar } from "@/presentation/dev/dev-toolbar";
import { Logo } from "@/shared/components/brand/logo";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/components/ui/empty";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Spinner } from "@/shared/components/ui/spinner";
import { Switch } from "@/shared/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useAlert } from "@/shared/hooks/use-alert";
import { cn } from "@/shared/lib/utils";

const COLOR_TOKENS = [
  { token: "background", role: "Fundo da página" },
  { token: "card", role: "Superfícies" },
  { token: "muted", role: "Fundo discreto" },
  { token: "accent", role: "Hover e ativo" },
  { token: "primary", role: "Petróleo: ação" },
  { token: "destructive", role: "Remover, revogar" },
  { token: "success", role: "Ativo, permitido" },
  { token: "warning", role: "Pendente" },
  { token: "key", role: "Latão: credencial" },
  { token: "border", role: "Divisórias" },
  { token: "input", role: "Borda de campo" },
  { token: "sidebar", role: "Navegação" },
];

const ROLE_ITEMS = [
  { label: "Escolha um papel", value: null },
  { label: "MEMBER", value: "member" },
  { label: "Gestor de acesso", value: "gestor" },
  { label: "Auditoria", value: "auditoria" },
];

// Datas fixas e fuso explícito: a amostra é renderizada no servidor e no cliente.
const sampleDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "America/Sao_Paulo",
});

const SAMPLE_MEMBERS = [
  { name: "Helena Duarte", email: "helena.duarte@valeverde.coop.br", role: "OWNER", joinedAt: "2025-09-15T13:00:00Z" },
  { name: "Camila Teixeira", email: "camila.teixeira@valeverde.coop.br", role: "Gestor de acesso", joinedAt: "2026-01-22T13:00:00Z" },
  { name: "Rafael Moreira", email: "rafael.moreira@valeverde.coop.br", role: "MEMBER", joinedAt: "2026-01-04T13:00:00Z" },
  { name: "Bruno Cardoso", email: "bruno.cardoso@valeverde.coop.br", role: "Auditoria", joinedAt: "2026-02-10T13:00:00Z" },
];

function RoleBadge({ role }: { role: string }) {
  if (role === "OWNER") return <Badge variant="key">OWNER</Badge>;
  if (role === "MEMBER") return <Badge variant="secondary">MEMBER</Badge>;
  return <Badge variant="outline">{role}</Badge>;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ThemePanel({ theme }: { theme: "light" | "dark" }) {
  const id = `panel-${theme}`;

  return (
    <div
      className={cn(
        theme,
        "flex min-w-0 flex-col gap-8 rounded-xl border bg-background p-4 text-foreground sm:p-6",
      )}
      aria-labelledby={id}
    >
      <h3 id={id} className="text-lg font-semibold">
        {theme === "light" ? "Tema claro" : "Tema escuro"}
      </h3>

      <Section title="Cores" description="Tokens do shadcn com a paleta do AccessFlow.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOR_TOKENS.map(({ token, role }) => (
            <li key={token} className="flex min-w-0 items-center gap-2">
              <span
                className="size-9 shrink-0 rounded-md ring-1 ring-foreground/10"
                style={{ background: `var(--${token})` }}
              />
              <span className="flex min-w-0 flex-col">
                <code className="truncate font-mono text-xs">{token}</code>
                <span className="truncate text-xs text-muted-foreground">{role}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="grid gap-1 text-sm">
          <p>Texto principal sobre o fundo.</p>
          <p className="text-muted-foreground">Texto secundário: metadados e descrições.</p>
          <p className="text-primary">Ação e link em petróleo.</p>
          <p className="text-destructive">Erro e ação destrutiva.</p>
          <p className="text-success">Status ativo ou permitido.</p>
          <p className="text-warning">Status pendente ou expirando.</p>
        </div>
      </Section>

      <Section title="Tipografia" description="IBM Plex Sans; IBM Plex Mono só para identificadores.">
        <div className="flex flex-col gap-2">
          <p className="font-heading text-2xl font-semibold">Membros da organização</p>
          <p className="font-heading text-lg font-semibold">Convidar membro</p>
          <p className="max-w-prose text-base">
            Quem recebe o convite entra com o papel escolhido e pode recusar. Convites vencem em 7 dias.
          </p>
          <p className="text-sm">Corpo do painel, em 14 px: tabelas, campos e menus.</p>
          <p className="text-xs font-medium text-muted-foreground">Cabeçalho de tabela e metadados</p>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <code className="font-mono text-xs">4f1c9a2e7b</code>
            <code className="font-mono text-xs">accessflow-api/members.read</code>
            <code className="font-mono text-xs">vale-verde</code>
          </p>
        </div>
      </Section>

      <Section title="Chave de permissão" description="O elemento reconhecível do produto.">
        <div className="flex flex-wrap gap-2">
          <PermissionKeyTag value="members:invite" />
          <PermissionKeyTag value="roles:manage" />
          <PermissionKeyTag value="audit:read" />
          <PermissionKeyTag value="faturas:aprovar" />
        </div>
      </Section>

      <Section title="Botões">
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <MailPlusIcon data-icon="inline-start" />
            Convidar membro
          </Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Cancelar</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="destructive">Revogar</Button>
          <Button variant="link">Ver detalhes</Button>
          <Button disabled>
            <Spinner data-icon="inline-start" />
            Salvando…
          </Button>
          <Button variant="outline" size="icon" aria-label="Copiar client_id">
            <CopyIcon />
          </Button>
        </div>
      </Section>

      <Section title="Badges de status" description="Sempre com texto: a cor nunca é o único sinal.">
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Ativa</Badge>
          <Badge variant="warning">Pendente</Badge>
          <Badge variant="outline">Expirado</Badge>
          <Badge variant="destructive">Revogada</Badge>
          <Badge variant="key">OWNER</Badge>
          <Badge variant="secondary">MEMBER</Badge>
          <Badge variant="outline">Gestor de acesso</Badge>
        </div>
      </Section>

      <Section title="Formulário">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>Nome da organização</FieldLabel>
            <Input id={`${id}-name`} defaultValue="Cooperativa Vale Verde" />
            <FieldDescription>De 2 a 100 caracteres.</FieldDescription>
          </Field>
          <Field data-invalid>
            <FieldLabel htmlFor={`${id}-email`}>E-mail</FieldLabel>
            <Input id={`${id}-email`} defaultValue="ana@" aria-invalid aria-describedby={`${id}-email-error`} />
            <FieldError id={`${id}-email-error`}>Informe um e-mail válido, como nome@empresa.com.br.</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-role`}>Papel</FieldLabel>
            <Select items={ROLE_ITEMS} defaultValue="member">
              <SelectTrigger id={`${id}-role`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ROLE_ITEMS.map((item) => (
                    <SelectItem key={item.label} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <FieldSet>
            <FieldLegend variant="label">Permissões do papel</FieldLegend>
            <Field orientation="horizontal">
              <Checkbox id={`${id}-p1`} defaultChecked />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-p1`}>
                  <PermissionKeyTag value="members:read" />
                </FieldLabel>
                <FieldDescription>Ver os membros</FieldDescription>
              </FieldContent>
            </Field>
            <Field orientation="horizontal" data-disabled>
              <Checkbox id={`${id}-p2`} disabled />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-p2`}>
                  <PermissionKeyTag value="integrations:manage" />
                  <LockIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
                </FieldLabel>
                <FieldDescription>Você não tem esta permissão, então não pode concedê-la.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldSet>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={`${id}-switch`}>Mostrar convites expirados</FieldLabel>
            </FieldContent>
            <Switch id={`${id}-switch`} defaultChecked />
          </Field>
        </FieldGroup>
      </Section>

      <Section title="Tabela" description="Linha de 40 px; rola dentro do contêiner, nunca a página.">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Entrou em</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_MEMBERS.map((member) => (
                <TableRow key={member.email}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.name}</span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sampleDate.format(new Date(member.joinedAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={`Mais ações para ${member.name}`}>
                      <MoreHorizontalIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Avisos">
        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>O papel OWNER não muda</AlertTitle>
          <AlertDescription>Ele tem todas as permissões da organização, inclusive as personalizadas.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Não foi possível excluir o papel</AlertTitle>
          <AlertDescription>Ele ainda é usado por 3 membros. Troque o papel deles antes de excluir.</AlertDescription>
        </Alert>
      </Section>

      <Section title="Vazio e carregando">
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CableIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma integração</EmptyTitle>
            <EmptyDescription>Crie uma integração para que um sistema consulte permissões pela API.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm">Criar integração</Button>
          </EmptyContent>
        </Empty>
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </Section>

      <Section title="Abas">
        <Tabs defaultValue="activity">
          <TabsList>
            <TabsTrigger value="activity">Atividade</TabsTrigger>
            <TabsTrigger value="decisions">Decisões de acesso</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="text-sm text-muted-foreground">
            Mudanças feitas na organização.
          </TabsContent>
          <TabsContent value="decisions" className="text-sm text-muted-foreground">
            Respostas dadas às integrações.
          </TabsContent>
          <TabsContent value="security" className="text-sm text-muted-foreground">
            Tentativas de acesso negadas.
          </TabsContent>
        </Tabs>
      </Section>
    </div>
  );
}

function OverlaysDemo() {
  const { Alert: showToast } = useAlert();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog>
        <DialogTrigger render={<Button />}>
          <MailPlusIcon data-icon="inline-start" />
          Abrir diálogo
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar membro</DialogTitle>
            <DialogDescription>O convite vale por 7 dias e pode ser revogado antes do aceite.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dialog-email">E-mail</FieldLabel>
              <Input id="dialog-email" type="email" autoComplete="off" placeholder="nome@empresa.com.br" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button>Enviar convite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" />}>Revogar integração</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar “ERP Financeiro”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os tokens dela deixam de autorizar na hora e o segredo não volta a funcionar. Para reconectar o
              sistema, será preciso criar outra integração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter integração</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Revogar integração</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <MoreHorizontalIcon data-icon="inline-start" />
          Mais ações
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <ShieldCheckIcon />
              Trocar papel
            </DropdownMenuItem>
            <DropdownMenuItem>
              <UsersIcon />
              Ver membros
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive">Remover da organização</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Copiar requestId" />}>
          <CopyIcon />
        </TooltipTrigger>
        <TooltipContent>Copiar requestId</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6" />

      <Button variant="outline" onClick={() => showToast({ variant: "success", message: "Convite enviado" })}>
        Toast de sucesso
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          showToast({ variant: "error", message: "Já existe um papel com esse nome. Escolha outro nome." })
        }
      >
        Toast de erro
      </Button>
      <Button variant="outline" onClick={() => showToast({ variant: "info", message: "Integração em criação" })}>
        Toast informativo
      </Button>
    </div>
  );
}

const DEMO_ORGANIZATION = "org-vale-verde";

function PermissionsDemo() {
  const { personaId } = useStore(sessionStore);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Persona atual: {getPersona(personaId).label}</CardTitle>
        <CardDescription>
          Permissões em Cooperativa Vale Verde. Troque a persona no controle do canto inferior esquerdo: a
          lista, os botões e o bloco protegido reagem.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ViewerPermissions organizationId={DEMO_ORGANIZATION} />
        <div className="flex flex-wrap gap-2">
          <Can organizationId={DEMO_ORGANIZATION} permissions={["members:invite"]}>
            <Button size="sm">Convidar membro</Button>
          </Can>
          <Can organizationId={DEMO_ORGANIZATION} permissions={["roles:manage"]}>
            <Button size="sm" variant="outline">
              Criar papel
            </Button>
          </Can>
          <Can organizationId={DEMO_ORGANIZATION} permissions={["integrations:manage"]}>
            <Button size="sm" variant="outline">
              Criar integração
            </Button>
          </Can>
        </div>
        <RequirePermission organizationId={DEMO_ORGANIZATION} permissions={["audit:read"]}>
          <Alert>
            <ShieldCheckIcon />
            <AlertTitle>Bloco protegido por audit:read</AlertTitle>
            <AlertDescription>Esta persona pode ver o registro de auditoria.</AlertDescription>
          </Alert>
        </RequirePermission>
      </CardContent>
    </Card>
  );
}

export function DesignPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Logo />
          <h1 className="font-heading text-2xl font-semibold">Direção visual</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Tokens, tipografia e componentes base nos dois temas. A justificativa de cada escolha está em{" "}
            <code className="font-mono text-xs">docs/design-direction.md</code>. Esta página não existe em produção.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section aria-labelledby="themes-title" className="flex flex-col gap-4">
        <h2 id="themes-title" className="font-heading text-lg font-semibold">
          Lado a lado
        </h2>
        <div className="grid gap-6 xl:grid-cols-2">
          <ThemePanel theme="light" />
          <ThemePanel theme="dark" />
        </div>
      </section>

      <section aria-labelledby="overlays-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="overlays-title" className="font-heading text-lg font-semibold">
            Sobreposições
          </h2>
          <p className="text-sm text-muted-foreground">
            Diálogos, menus e toasts abrem sobre a página, no tema escolhido no topo.
          </p>
        </div>
        <OverlaysDemo />
      </section>

      <section aria-labelledby="permissions-title" className="flex flex-col gap-4">
        <h2 id="permissions-title" className="font-heading text-lg font-semibold">
          Permissões na interface
        </h2>
        <PermissionsDemo />
      </section>
      <Suspense fallback={null}>
        <DevToolbar />
      </Suspense>
    </main>
  );
}
