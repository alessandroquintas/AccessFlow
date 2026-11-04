import { DataTable } from "@/shared/components/data-table";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";

/**
 * Skeletons com o formato das telas reais (mesmas colunas, larguras e
 * espaçamento), para o conteúdo entrar sem salto. Todos são aria-hidden: o
 * anúncio fica com o LoadingRegion que os envolve.
 */

/** Larguras das barras de texto, alternadas entre linhas para não parecer uma grade. */
const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-2/5", "w-3/5"];
const widthAt = (row: number, column = 0) => WIDTHS[(row * 2 + column) % WIDTHS.length];

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

/** Barra na altura de uma linha de texto de 14 px (20 px de entrelinha). */
function TextBar({ className }: { className?: string }) {
  return (
    <span className="flex h-5 items-center">
      <Skeleton className={cn("h-3.5", className)} />
    </span>
  );
}

export interface TableSkeletonColumn {
  /** O cabeçalho não depende dos dados: o skeleton repete o da tabela real. */
  label: string;
  /** Rótulo só para leitores de tela na tabela real (a coluna de ações). */
  hideLabel?: boolean;
  /** text: barra de largura variável; badge: pílula; date: barra à direita; action: botão de ícone. */
  cell?: "text" | "badge" | "date" | "action";
  /** As mesmas classes da coluna real (largura, alinhamento, visibilidade). */
  className?: string;
}

export function TableSkeleton({
  columns,
  rows = 6,
  className,
}: {
  columns: TableSkeletonColumn[];
  rows?: number;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={className}>
      <DataTable>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.label} className={column.className}>
                {!column.hideLabel && column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {range(rows).map((row) => (
            <TableRow key={row} className="hover:bg-transparent">
              {columns.map((column, index) => (
                <TableCell key={column.label} className={column.className}>
                  {column.cell === "badge" ? (
                    <Skeleton className={cn("h-5 rounded-4xl", row % 3 === 0 ? "w-20" : "w-16")} />
                  ) : column.cell === "date" ? (
                    <TextBar className="ml-auto w-24" />
                  ) : column.cell === "action" ? (
                    <Skeleton className="ml-auto size-7" />
                  ) : (
                    <TextBar className={cn("max-w-56", widthAt(row, index))} />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </div>
  );
}

/**
 * summary: cartões de resumo da visão geral (rótulo, número, link).
 * detail: cartões com título, descrição, badge e rodapé (organizações, convites recebidos).
 */
export function CardGridSkeleton({
  count = 3,
  variant = "detail",
  footer = "meta",
  className = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
}: {
  count?: number;
  variant?: "summary" | "detail";
  /** Só no detail: metadados nas pontas ou botões à direita. */
  footer?: "meta" | "actions";
  /** A mesma grade da lista real. */
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={className}>
      {range(count).map((index) =>
        variant === "summary" ? (
          <Card key={index} size="sm">
            <CardHeader>
              <TextBar className={cn(index % 2 ? "w-24" : "w-32")} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <span className="flex h-8 items-center">
                <Skeleton className="h-6 w-12" />
              </span>
              <span className="flex h-4 items-center">
                <Skeleton className="h-3 w-20" />
              </span>
            </CardContent>
          </Card>
        ) : (
          <Card key={index}>
            <CardHeader>
              <TextBar className={cn("h-4", widthAt(index))} />
              <CardDescription>
                <TextBar className={cn(index % 2 ? "w-1/2" : "w-2/5")} />
              </CardDescription>
              <CardAction>
                <Skeleton className="h-5 w-16 rounded-4xl" />
              </CardAction>
            </CardHeader>
            <CardFooter className={footer === "actions" ? "justify-end gap-2" : "justify-between gap-2"}>
              {footer === "actions" ? (
                <>
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-32" />
                </>
              ) : (
                <>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-28" />
                </>
              )}
            </CardFooter>
          </Card>
        ),
      )}
    </div>
  );
}

/** Lista simples: ícone opcional, linhas de texto e o tempo (ou um botão) à direita. */
export function ListSkeleton({
  rows = 5,
  icon = true,
  lines = 2,
  trailing = "time",
  className,
}: {
  rows?: number;
  icon?: boolean;
  /** Linhas de texto por item: a primeira na altura do texto, as outras menores. */
  lines?: number;
  trailing?: "time" | "action";
  className?: string;
}) {
  return (
    <ul aria-hidden="true" className={cn("flex flex-col divide-y", className)}>
      {range(rows).map((row) => (
        <li key={row} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          {icon && <Skeleton className="size-8 shrink-0 rounded-md" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <TextBar className={widthAt(row)} />
            {range(lines - 1).map((line) => (
              <span key={line} className="flex h-4 items-center">
                <Skeleton className={cn("h-3", (row + line) % 2 ? "w-24" : "w-32")} />
              </span>
            ))}
          </div>
          {trailing === "action" ? (
            <Skeleton className="size-7 shrink-0" />
          ) : (
            <span className="flex h-5 shrink-0 items-center">
              <Skeleton className="h-3 w-14" />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Rótulo + campo (+ dica), e o botão de enviar. */
export function FormSkeleton({
  fields = 2,
  submit = true,
  className,
}: {
  fields?: number;
  submit?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-7">
        {range(fields).map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <span className="flex h-5 items-center">
              <Skeleton className={cn("h-3.5", field % 2 ? "w-16" : "w-28")} />
            </span>
            <Skeleton className="h-8 w-full rounded-lg" />
            <span className="flex h-5 items-center">
              <Skeleton className={cn("h-3", widthAt(field, 1))} />
            </span>
          </div>
        ))}
      </div>
      {submit && <Skeleton className="h-8 w-36 rounded-lg" />}
    </div>
  );
}

/** Título (e descrição) da página, com as ações à direita. */
export function PageHeaderSkeleton({
  description = true,
  actions = 0,
  className,
}: {
  description?: boolean;
  actions?: number;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex h-8 items-center">
          <Skeleton className="h-6 w-56 max-w-full" />
        </span>
        {description && <TextBar className="w-80 max-w-full" />}
      </div>
      {actions > 0 && (
        <div className="flex shrink-0 gap-2">
          {range(actions).map((action) => (
            <Skeleton key={action} className="h-8 w-32 rounded-lg" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Busca e filtros acima de uma lista. */
export function FilterBarSkeleton({ filters = 1 }: { filters?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 sm:flex-row">
      <Skeleton className="h-8 w-full rounded-lg sm:max-w-xs" />
      {range(filters).map((filter) => (
        <Skeleton key={filter} className="h-8 w-full rounded-lg sm:w-44" />
      ))}
    </div>
  );
}

/**
 * A casca do app enquanto a sessão é verificada: sidebar (só do tablet para
 * cima, como a real), barra superior, título e conteúdo.
 */
export function AppShellSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-svh w-full">
      <div className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-2 md:flex">
        <div className="flex h-12 items-center gap-2 px-2">
          <Skeleton className="size-8 shrink-0" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        {[7, 3].map((items, group) => (
          <div key={group} className="flex flex-col gap-1 px-2">
            <span className="flex h-8 items-center">
              <Skeleton className="h-3 w-20" />
            </span>
            {range(items).map((item) => (
              <span key={item} className="flex h-8 items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded-sm" />
                <Skeleton className={cn("h-3.5", widthAt(item + group, 1), "max-w-36")} />
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <Skeleton className="size-7" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="ml-auto size-8" />
        </div>
        <PageHeaderSkeleton className="px-4 pt-6 sm:px-6" />
        <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
          <CardGridSkeleton variant="summary" count={4} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" />
          <ListSkeleton rows={5} className="rounded-xl border p-4" />
        </div>
      </div>
    </div>
  );
}

/** Cartão centralizado com formulário (o onboarding), enquanto a sessão é verificada. */
export function CenteredCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <Skeleton className="h-6 w-32" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <span className="flex h-7 items-center">
            <Skeleton className="h-5 w-56" />
          </span>
          <TextBar className="w-full" />
          <TextBar className="w-2/3" />
        </CardHeader>
        <CardContent>
          <FormSkeleton fields={2} />
        </CardContent>
      </Card>
    </div>
  );
}
