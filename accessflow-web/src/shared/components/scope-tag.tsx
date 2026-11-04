import { cn } from "@/shared/lib/utils";

/**
 * Escopo de máquina (`accessflow-api/authorize`) no mesmo desenho da chave de
 * permissão: o servidor de recursos apagado, o escopo em destaque.
 */
export function ScopeTag({ value, className }: { value: string; className?: string }) {
  const separator = value.lastIndexOf("/");
  const server = separator === -1 ? "" : value.slice(0, separator + 1);
  const scope = separator === -1 ? value : value.slice(separator + 1);

  return (
    <code translate="no"
      data-slot="scope-tag"
      className={cn(
        // Inline (e não flex): em coluna estreita, quebra só depois da barra.
        "inline-block max-w-full rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-xs leading-tight",
        className,
      )}
    >
      {server && (
        <>
          <span className="text-muted-foreground">{server}</span>
          <wbr />
        </>
      )}
      <span className="font-medium text-foreground">{scope}</span>
    </code>
  );
}
