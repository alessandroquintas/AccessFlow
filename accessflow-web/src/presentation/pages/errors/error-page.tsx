"use client";

import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "@/shared/components/brand/logo";
import { Button } from "@/shared/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";

interface ErrorPageProps {
  error: unknown;
  retry: () => void;
}

/** Erro inesperado. O `digest` do Next faz o papel de requestId (liga ao log do servidor). */
export function ErrorPage({ error, retry }: ErrorPageProps) {
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : undefined;

  useEffect(() => {
    // Fase 11b: enviar para o serviço de observabilidade, com o requestId da API quando houver.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo />
      <Empty className="max-w-md border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>
            <h1>Algo deu errado</h1>
          </EmptyTitle>
          <EmptyDescription>
            Um erro inesperado interrompeu esta tela. Tente de novo; se continuar, fale com o suporte e
            informe o código abaixo.
          </EmptyDescription>
          {digest && (
            <EmptyDescription>
              Código para o suporte: <code className="font-mono select-all">{digest}</code>
            </EmptyDescription>
          )}
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button onClick={retry}>
            <RotateCwIcon data-icon="inline-start" />
            Tentar de novo
          </Button>
          <Button variant="outline" render={<Link href="/organizations" />} nativeButton={false}>
            Minhas organizações
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
