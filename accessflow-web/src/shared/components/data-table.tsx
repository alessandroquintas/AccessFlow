import { Table } from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";

/**
 * Moldura e densidade das listas (docs/design-direction.md): linha de 40 px,
 * cabeçalho de 36 px em 12 px. A tabela rola dentro da moldura, nunca a
 * página. O TableSkeleton usa a mesma moldura, para não haver salto.
 */
export function DataTable({ className, ...props }: React.ComponentProps<typeof Table>) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table
        className={cn(
          "[&_tbody_tr]:h-10 [&_td]:py-1.5 [&_th]:h-9 [&_th]:text-xs [&_th]:text-muted-foreground",
          className,
        )}
        {...props}
      />
    </div>
  );
}
