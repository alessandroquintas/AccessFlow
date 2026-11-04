"use client";

import { FilterXIcon, ScrollTextIcon } from "lucide-react";
import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { FilterBarSkeleton, ListSkeleton, TableSkeleton, type TableSkeletonColumn } from "@/shared/components/feedback/skeletons";
import { Button } from "@/shared/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { pluralize } from "@/shared/lib/format";

export function FeedSkeleton({ label, columns, filters }: { label: string; columns: TableSkeletonColumn[]; filters: number }) {
  return (
    <LoadingRegion label={label} className="flex flex-col gap-4">
      <FilterBarSkeleton filters={filters} />
      <TableSkeleton columns={columns} rows={8} className="hidden md:block" />
      <ListSkeleton rows={5} icon={false} lines={3} className="rounded-lg border px-3 py-3 md:hidden" />
    </LoadingRegion>
  );
}

/** Nada no período (ou nos filtros): diz o que fazer. */
export function FeedEmpty({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{filtered ? <FilterXIcon /> : <ScrollTextIcon />}</EmptyMedia>
        <EmptyTitle>{filtered ? "Nada encontrado com estes filtros" : "Nada registrado no período"}</EmptyTitle>
        <EmptyDescription>
          {filtered ? "Amplie o período ou tire algum filtro." : "Quando algo acontecer na organização, aparece aqui."}
        </EmptyDescription>
      </EmptyHeader>
      {filtered && (
        <EmptyContent>
          <Button variant="outline" onClick={onClear}>
            Limpar filtros
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

export function LoadMore({ shown, total, noun, onMore }: { shown: number; total: number; noun: [string, string]; onMore: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
        Mostrando {shown} de {pluralize(total, noun[0], noun[1])}
      </p>
      {shown < total && (
        <Button variant="outline" onClick={onMore}>
          Carregar mais
        </Button>
      )}
    </div>
  );
}
