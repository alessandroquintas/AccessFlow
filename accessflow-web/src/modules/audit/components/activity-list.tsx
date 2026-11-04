"use client";

import { ChevronDownIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { DataTable } from "@/shared/components/data-table";
import type { TableSkeletonColumn } from "@/shared/components/feedback/skeletons";
import { RelativeTime } from "@/shared/components/relative-time";
import { Button } from "@/shared/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";
import { actorLabel, describeAuditEvent, plainText } from "../lib/describe";
import type { AuditDirectory, AuditEvent } from "../schemas";
import { DetailList, SegmentText } from "./audit-parts";

export const ACTIVITY_COLUMNS: TableSkeletonColumn[] = [
  { label: "Quando", className: "w-32" },
  { label: "Quem", className: "w-44" },
  { label: "O quê" },
  { label: "Detalhes", hideLabel: true, cell: "action", className: "w-28 text-right" },
];

function ToggleDetails({ open, controls, onToggle, label }: { open: boolean; controls: string; onToggle: () => void; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`${open ? "Ocultar" : "Ver"} detalhes: ${label}`}
      onClick={onToggle}
    >
      Detalhes
      <ChevronDownIcon data-icon="inline-end" className={cn("transition-transform", open && "rotate-180")} />
    </Button>
  );
}

/** A trilha: tabela do tablet para cima, lista no celular; cada registro abre os detalhes. */
export function ActivityList({ events, directory }: { events: AuditEvent[]; directory: AuditDirectory }) {
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (id: string) => setOpen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const described = events.map((event) => ({ event, ...describeAuditEvent(event, directory), actor: actorLabel(event.actor, directory) }));

  return (
    <>
      <div className="hidden md:block">
        <DataTable className="[&_td]:whitespace-normal">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {ACTIVITY_COLUMNS.map((column) => (
                <TableHead key={column.label} className={column.className}>
                  {column.hideLabel ? <span className="sr-only">{column.label}</span> : column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {described.map(({ event, summary, details, actor }) => {
              const expanded = open.includes(event.id);
              const panel = `details-${event.id}`;
              return (
                <Fragment key={event.id}>
                  <TableRow className={cn(expanded && "border-b-0")}>
                    <TableCell className="text-muted-foreground">
                      <RelativeTime iso={event.occurredAt} />
                    </TableCell>
                    <TableCell className="font-medium">{actor}</TableCell>
                    <TableCell>
                      <SegmentText segments={summary} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ToggleDetails
                        open={expanded}
                        controls={panel}
                        onToggle={() => toggle(event.id)}
                        label={`${actor} ${plainText(summary)}`}
                      />
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow id={panel} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={ACTIVITY_COLUMNS.length} className="px-4 py-3">
                        <DetailList items={details} requestId={event.requestId} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </DataTable>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border px-3 py-3 md:hidden" aria-label="Atividade">
        {described.map(({ event, summary, details, actor }) => {
          const expanded = open.includes(event.id);
          const panel = `details-mobile-${event.id}`;
          return (
            <li key={event.id} className="flex flex-col gap-2 py-3 text-sm first:pt-0 last:pb-0">
              <p>
                <span className="font-medium">{actor}</span> <SegmentText segments={summary} />
              </p>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <RelativeTime iso={event.occurredAt} />
                <ToggleDetails open={expanded} controls={panel} onToggle={() => toggle(event.id)} label={`${actor} ${plainText(summary)}`} />
              </div>
              {expanded && (
                <div id={panel} className="rounded-md bg-muted/40 p-3">
                  <DetailList items={details} requestId={event.requestId} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
