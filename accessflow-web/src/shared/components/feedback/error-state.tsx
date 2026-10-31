import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/components/ui/empty";

interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Código para o suporte achar o erro no log, quando houver. */
  requestId?: string;
  onRetry?: () => void;
}

/** Falha ao carregar: diz o que houve e oferece "Tentar de novo". */
export function ErrorState({
  title = "Não foi possível carregar",
  description = "Sem conexão com o servidor. Verifique sua internet e tente de novo.",
  requestId,
  onRetry,
}: ErrorStateProps) {
  return (
    <Empty role="alert" className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
        {requestId && (
          <EmptyDescription>
            Código para o suporte: <code className="font-mono">{requestId}</code>
          </EmptyDescription>
        )}
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            <RotateCwIcon data-icon="inline-start" />
            Tentar de novo
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
