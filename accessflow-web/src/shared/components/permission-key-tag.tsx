import { cn } from "@/shared/lib/utils";

/**
 * A chave `recurso:ação` no formato próprio do AccessFlow: recurso apagado,
 * ação em destaque, mono e canto de etiqueta. Ver docs/design-direction.md.
 */
export function PermissionKeyTag({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const separator = value.indexOf(":");
  const resource = separator === -1 ? value : value.slice(0, separator);
  const action = separator === -1 ? "" : value.slice(separator + 1);

  return (
    <code
      data-slot="permission-key"
      className={cn(
        "inline-flex max-w-full items-baseline rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-xs leading-none break-all",
        className,
      )}
    >
      <span className="text-muted-foreground">{resource}</span>
      {action && (
        <>
          <span className="px-px text-muted-foreground">:</span>
          <span className="font-medium text-foreground">{action}</span>
        </>
      )}
    </code>
  );
}
