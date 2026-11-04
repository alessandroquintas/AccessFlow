"use client";

import { useHydrated } from "@/shared/hooks/use-hydrated";
import { formatDateTime, formatRelative } from "@/shared/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";

/**
 * "há 3 horas", com a data e a hora absolutas no tooltip (no fuso de quem
 * lê). Focável, para o tooltip abrir também pelo teclado.
 */
export function RelativeTime({ iso }: { iso: string }) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return <span aria-hidden="true" className="inline-block h-[1em] w-16 rounded-sm bg-muted align-middle" />;
  }

  const absolute = formatDateTime(iso);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time
            dateTime={iso}
            tabIndex={0}
            aria-label={`${formatRelative(iso)}, ${absolute}`}
            className="cursor-default rounded-sm whitespace-nowrap underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {formatRelative(iso)}
      </TooltipTrigger>
      <TooltipContent>{absolute}</TooltipContent>
    </Tooltip>
  );
}
