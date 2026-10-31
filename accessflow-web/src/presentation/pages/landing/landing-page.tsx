import { LogInIcon } from "lucide-react";
import { Suspense } from "react";
import { SignInButton } from "@/modules/auth/containers/sign-in-button";
import { PublicLayout } from "@/presentation/layouts/public-layout";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";

/** Amostra do registro: o que o produto faz, contado pelo próprio livro. */
const LEDGER = [
  { actor: "Helena Duarte", action: "concedeu ao papel Gestor de acesso", permission: "members:invite", when: "há 2 min" },
  { actor: "ERP Financeiro", action: "perguntou se Bruno Cardoso pode", permission: "faturas:aprovar", when: "há 9 min", outcome: "allowed" as const },
  { actor: "Rafael Moreira", action: "tentou abrir o editor de papéis sem", permission: "roles:manage", when: "há 1 h", outcome: "denied" as const },
  { actor: "Camila Teixeira", action: "convidou um membro com o papel Auditoria", when: "ontem" },
];

export function LandingPage() {
  return (
    <PublicLayout>
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_minmax(0,28rem)] lg:py-20">
        <section className="flex max-w-xl flex-col gap-6">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Quem pode fazer o quê na sua organização, e quem fez.
          </h1>
          <p className="text-base text-muted-foreground">
            O AccessFlow reúne os papéis e as permissões da organização, entrega credenciais às
            integrações e anota cada mudança de acesso num registro que não se apaga.
          </p>
          <div className="flex flex-col items-start gap-3">
            {/* O botão lê o `next` da URL (useSearchParams): fica sob Suspense. */}
            <Suspense
              fallback={
                <Button size="lg" disabled>
                  <LogInIcon data-icon="inline-start" />
                  Entrar
                </Button>
              }
            >
              <SignInButton />
            </Suspense>
            <p className="text-sm text-muted-foreground">
              Você entra pela página de login da sua conta. O AccessFlow não pede nem guarda sua senha.
            </p>
          </div>
        </section>

        <Card aria-label="Exemplo do registro de auditoria">
          <CardHeader>
            <CardTitle>Registro</CardTitle>
            <CardDescription>Cooperativa Vale Verde</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3">
              {LEDGER.map((entry, index) => (
                <li key={entry.actor} className="flex flex-col gap-3">
                  {index > 0 && <Separator />}
                  <div className="flex flex-col gap-1.5 text-sm">
                    <p>
                      <span className="font-medium">{entry.actor}</span>{" "}
                      <span className="text-muted-foreground">{entry.action}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {entry.permission && <PermissionKeyTag value={entry.permission} />}
                      {entry.outcome === "allowed" && <Badge variant="success">Permitido</Badge>}
                      {entry.outcome === "denied" && <Badge variant="destructive">Negado</Badge>}
                      <span className="ml-auto text-xs text-muted-foreground">{entry.when}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
