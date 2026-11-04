"use client";

import { EyeIcon, EyeOffIcon, KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/shared/components/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import type { CreatedIntegration } from "../schemas";

interface SecretDialogProps {
  /** A resposta da criação; null fecha o diálogo. */
  created: CreatedIntegration | null;
  tokenEndpoint: string;
  /** Chamado só depois da confirmação: quem chama descarta o segredo. */
  onDone: () => void;
}

/** Exemplo de client credentials: com variáveis, nunca com o segredo embutido. */
export const tokenRequestExample = (tokenEndpoint: string, scopes: readonly string[]) =>
  [
    `curl -X POST "${tokenEndpoint}" \\`,
    `  -u "$CLIENT_ID:$CLIENT_SECRET" \\`,
    `  -H "Content-Type: application/x-www-form-urlencoded" \\`,
    `  --data-urlencode "grant_type=client_credentials" \\`,
    `  --data-urlencode "scope=${scopes.join(" ")}"`,
  ].join("\n");

function Credential({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const id = `credential-${label}`;
  const shown = secret && !revealed ? "•".repeat(Math.min(value.length, 32)) : value;

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        <code translate="no" className="font-mono">{label}</code>
      </FieldLabel>
      <div className="flex items-center gap-1 rounded-lg border bg-muted/50 py-1 pr-1 pl-2.5">
        <output id={id} aria-label={secret && !revealed ? `${label} oculto` : label} className="min-w-0 flex-1 truncate font-mono text-sm">
          {shown}
        </output>
        {secret && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={revealed}
            onClick={() => setRevealed((current) => !current)}
          >
            {revealed ? <EyeOffIcon data-icon="inline-start" /> : <EyeIcon data-icon="inline-start" />}
            {revealed ? "Ocultar" : "Mostrar"}
          </Button>
        )}
        {/* Copia o valor real mesmo mascarado. */}
        <CopyButton value={value} label={label} variant="outline" />
      </div>
    </Field>
  );
}

/**
 * O client_secret aparece só aqui. O diálogo só fecha depois de "Copiei e
 * guardei o segredo": Esc, clique fora e o X não fecham antes disso.
 */
export function SecretDialog({ created, tokenEndpoint, onDone }: SecretDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const example = created ? tokenRequestExample(tokenEndpoint, created.integration.scopes) : "";

  const done = () => {
    setConfirmed(false);
    onDone();
  };

  return (
    <Dialog
      open={created !== null}
      disablePointerDismissal
      // Esc só fecha depois da confirmação.
      onOpenChange={(open) => !open && confirmed && done()}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Integração {created?.integration.name} criada</DialogTitle>
          <DialogDescription>
            Configure estas credenciais no sistema que vai consultar o AccessFlow.
          </DialogDescription>
        </DialogHeader>
        {created && (
          <div className="flex min-w-0 flex-col gap-4">
            <Alert className="border-key-foreground/30 bg-key/40">
              <KeyRoundIcon />
              <AlertTitle>Este segredo aparece só agora</AlertTitle>
              <AlertDescription>
                Guarde-o num cofre de segredos; o AccessFlow não consegue mostrá-lo de novo. Se perder, revogue a
                integração e crie outra.
              </AlertDescription>
            </Alert>
            <Credential label="client_id" value={created.integration.clientId ?? ""} />
            <Credential label="client_secret" value={created.clientSecret} secret />
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Como obter um token (client credentials)</p>
                <CopyButton value={example} label="exemplo" />
              </div>
              <pre className="max-w-full overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                <code translate="no">{example}</code>
              </pre>
              <p className="text-xs text-muted-foreground">
                Defina <code translate="no" className="font-mono">CLIENT_ID</code> e <code translate="no" className="font-mono">CLIENT_SECRET</code>{" "}
                como variáveis de ambiente do sistema; não cole o segredo no código.
              </p>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="secret-confirmed"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked)}
              />
              <FieldLabel htmlFor="secret-confirmed">Copiei e guardei o segredo</FieldLabel>
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button disabled={!confirmed} onClick={done}>
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
