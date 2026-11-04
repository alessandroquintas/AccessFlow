"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { useNow } from "@/shared/hooks/use-now";
import { MultiSelect, PeriodSelect, RetentionNote, SingleSelect } from "../components/audit-parts";
import { FeedEmpty, FeedSkeleton, LoadMore } from "../components/feed";
import { SECURITY_COLUMNS, SecurityList } from "../components/security-list";
import { useAudit } from "../hooks/use-audit";
import { SECURITY_EVENT_LABELS } from "../lib/describe";
import { PAGE_SIZE, type Period, withinPeriod } from "../lib/period";
import { SECURITY_EVENTS, type SecurityEvent, type SecurityEventType } from "../schemas";

interface Filters {
  events: SecurityEventType[];
  /** "user:<id>" ou "client:<client_id>" (actorUserId ou actorClientId no filtro da API). */
  actor: string | null;
  period: Period;
}

const INITIAL: Filters = { events: [], actor: null, period: "30d" };

const EVENT_GROUPS = [
  {
    label: "Pessoas",
    options: SECURITY_EVENTS.filter((event) => event.startsWith("access.")).map((value) => ({ value, label: SECURITY_EVENT_LABELS[value] })),
  },
  {
    label: "Integrações",
    options: SECURITY_EVENTS.filter((event) => event.startsWith("machine.")).map((value) => ({ value, label: SECURITY_EVENT_LABELS[value] })),
  },
];

const actorKey = ({ actor }: SecurityEvent) => (actor.type === "MACHINE" ? `client:${actor.clientId}` : `user:${actor.userId}`);

/** Aba Segurança: tentativas negadas (retenção de 180 dias). */
export function SecurityEvents({ organizationId }: { organizationId: string }) {
  const pathname = usePathname();
  const scenario = useScenario();
  const now = useNow();
  const { security, directory } = useAudit(organizationId);
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (scenario === "loading") return <FeedSkeleton label="Carregando eventos de segurança…" columns={SECURITY_COLUMNS} filters={2} />;
  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  const change = (next: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setVisible(PAGE_SIZE);
  };

  const actors = [
    ...new Map(
      security.map((event) => [
        actorKey(event),
        event.actor.type === "MACHINE"
          ? `${(event.actor.clientId && directory.integrations[event.actor.clientId]) ?? "Integração externa"} (integração)`
          : (event.actor.name ?? "Usuário sem perfil"),
      ]),
    ).entries(),
  ].map(([value, label]) => ({ value, label }));

  const filtered = (scenario === "empty" ? [] : security).filter(
    (event) =>
      (filters.events.length === 0 || filters.events.includes(event.event)) &&
      (filters.actor === null || actorKey(event) === filters.actor) &&
      withinPeriod(event.occurredAt, filters.period, now),
  );
  const isFiltered = filters.events.length > 0 || filters.actor !== null || filters.period !== "180d";

  return (
    <div className="flex flex-col gap-4">
      <RetentionNote>
        Tentativas de acesso negadas ficam guardadas por 180 dias; depois disso, são apagadas.
      </RetentionNote>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <MultiSelect
          label="Evento"
          allLabel="Todos os eventos"
          value={filters.events}
          groups={EVENT_GROUPS}
          onChange={(events) => change({ events })}
        />
        <SingleSelect
          label="Ator"
          allLabel="Todos os atores"
          value={filters.actor}
          options={actors}
          onChange={(actor) => change({ actor })}
          className="w-full sm:w-56"
        />
        <PeriodSelect value={filters.period} options={["24h", "7d", "30d", "90d", "180d"]} onChange={(period) => change({ period })} />
      </div>
      {filtered.length === 0 ? (
        <FeedEmpty filtered={isFiltered && scenario !== "empty"} onClear={() => change({ ...INITIAL, period: "180d" })} />
      ) : (
        <>
          <SecurityList events={filtered.slice(0, visible)} directory={directory} />
          <LoadMore
            shown={Math.min(visible, filtered.length)}
            total={filtered.length}
            noun={["evento", "eventos"]}
            onMore={() => setVisible((count) => count + PAGE_SIZE)}
          />
        </>
      )}
    </div>
  );
}
