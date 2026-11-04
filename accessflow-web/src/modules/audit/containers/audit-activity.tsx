"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { useNow } from "@/shared/hooks/use-now";
import { ActivityList, ACTIVITY_COLUMNS } from "../components/activity-list";
import { MultiSelect, PeriodSelect, RetentionNote, SingleSelect } from "../components/audit-parts";
import { FeedEmpty, FeedSkeleton, LoadMore } from "../components/feed";
import { useAudit } from "../hooks/use-audit";
import { ACTION_LABELS } from "../lib/describe";
import { PAGE_SIZE, type Period, withinPeriod } from "../lib/period";
import { AUDIT_ACTIONS, type AuditAction } from "../schemas";

const GROUPS: { label: string; prefix: string }[] = [
  { label: "Organização", prefix: "organization." },
  { label: "Membros", prefix: "member." },
  { label: "Convites", prefix: "invitation." },
  { label: "Papéis", prefix: "role." },
  { label: "Permissões", prefix: "permission." },
  { label: "Integrações", prefix: "integration." },
];

const ACTION_GROUPS = GROUPS.map(({ label, prefix }) => ({
  label,
  options: AUDIT_ACTIONS.filter((action) => action.startsWith(prefix)).map((action) => ({
    value: action,
    label: ACTION_LABELS[action],
  })),
}));

interface Filters {
  actions: AuditAction[];
  actorUserId: string | null;
  period: Period;
}

const INITIAL: Filters = { actions: [], actorUserId: null, period: "30d" };

/** Aba Atividade: a trilha administrativa (sem expurgo). */
export function AuditActivity({ organizationId }: { organizationId: string }) {
  const pathname = usePathname();
  const scenario = useScenario();
  const now = useNow();
  const { events, directory } = useAudit(organizationId);
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (scenario === "loading") return <FeedSkeleton label="Carregando atividade…" columns={ACTIVITY_COLUMNS} filters={2} />;
  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  const change = (next: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setVisible(PAGE_SIZE);
  };

  // Quem aparece na trilha (ator USER), por nome.
  const actors = [...new Map(events.flatMap(({ actor }) => (actor.userId && actor.name ? [[actor.userId, actor.name]] : []))).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  const filtered = (scenario === "empty" ? [] : events).filter(
    (event) =>
      (filters.actions.length === 0 || filters.actions.includes(event.action)) &&
      (filters.actorUserId === null || event.actor.userId === filters.actorUserId) &&
      withinPeriod(event.occurredAt, filters.period, now),
  );
  const isFiltered = filters.actions.length > 0 || filters.actorUserId !== null || filters.period !== "all";

  return (
    <div className="flex flex-col gap-4">
      <RetentionNote>A trilha administrativa é guardada sem prazo: nenhuma mudança é apagada.</RetentionNote>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <MultiSelect
          label="Ação"
          allLabel="Todas as ações"
          value={filters.actions}
          groups={ACTION_GROUPS}
          onChange={(actions) => change({ actions })}
        />
        <SingleSelect
          label="Quem"
          allLabel="Todas as pessoas"
          value={filters.actorUserId}
          options={actors}
          onChange={(actorUserId) => change({ actorUserId })}
        />
        <PeriodSelect
          value={filters.period}
          options={["24h", "7d", "30d", "90d", "180d", "all"]}
          onChange={(period) => change({ period })}
        />
      </div>
      {filtered.length === 0 ? (
        <FeedEmpty filtered={isFiltered && scenario !== "empty"} onClear={() => change({ ...INITIAL, period: "all" })} />
      ) : (
        <>
          <ActivityList events={filtered.slice(0, visible)} directory={directory} />
          <LoadMore
            shown={Math.min(visible, filtered.length)}
            total={filtered.length}
            noun={["registro", "registros"]}
            onMore={() => setVisible((count) => count + PAGE_SIZE)}
          />
        </>
      )}
    </div>
  );
}
