import { Spinner } from "@/shared/components/ui/spinner";

/** Tela inteira de espera: callback de login e checagem de sessão. */
export function FullPageStatus({ message }: { message: string }) {
  return (
    <div role="status" className="flex min-h-svh flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
      <Spinner className="size-5" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
