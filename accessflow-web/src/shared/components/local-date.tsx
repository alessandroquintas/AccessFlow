"use client";

import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatDate, formatDateTime, formatRelative } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

interface LocalDateProps {
  iso: string;
  format?: "date" | "datetime" | "relative";
  className?: string;
}

/**
 * Data no fuso e no relógio de quem lê. Formatada só no navegador: no
 * servidor o fuso e o "agora" são outros, e a hidratação divergiria.
 */
export function LocalDate({ iso, format = "date", className }: LocalDateProps) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return <span aria-hidden="true" className={cn("inline-block h-[1em] w-16 rounded-sm bg-muted align-middle", className)} />;
  }

  const text =
    format === "relative" ? formatRelative(iso) : format === "datetime" ? formatDateTime(iso) : formatDate(iso);

  return (
    <time dateTime={iso} title={format === "relative" ? formatDateTime(iso) : undefined} className={className}>
      {text}
    </time>
  );
}
