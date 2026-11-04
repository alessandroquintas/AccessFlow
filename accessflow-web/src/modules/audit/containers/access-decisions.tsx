"use client";

import { SearchIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/components/ui/input-group";
import { useNow } from "@/shared/hooks/use-now";
import { PeriodSelect, RetentionNote, SingleSelect } from "../components/audit-parts";
import { DECISION_COLUMNS, DecisionList } from "../components/decision-list";
import { FeedEmpty, FeedSkeleton, LoadMore } from "../components/feed";
import { useAudit } from "../hooks/use-audit";
import { ALLOWED_FILTER_LABELS, type AllowedFilter, matchesAllowed } from "../lib/describe";
import { PAGE_SIZE, type Period, withinPeriod } from "../lib/period";

interface Filters {
  /** Vira o `allowed` do filtro da API. */
  allowed: AllowedFilter | null;
  subjectUserId: string | null;
  clientId: string | null;
  permission: string;
  period: Period;
}

const INITIAL: Filters = { allowed: null, subjectUserId: null, clientId: null, permission: "", period: "30d" };

const RESULTS = (Object.keys(ALLOWED_FILTER_LABELS) as AllowedFilter[]).map((value) => ({
  value,
  label: ALLOWED_FILTER_LABELS[value],
}));

/**
 * Aba Decisões de acesso (retenção de 90 dias). Fase 11b: resultado
 * (allowed), usuário, integração, permissão e período vão no
 * AuthorizationDecisionFilter. O badge "Parcial" continua na tabela; no
 * filtro, o parcial entra em "Negado".
 */
export function AccessDecisions({ organizationId }: { organizationId: string }) {
  const pathname = usePathname();
  const scenario = useScenario();
  const now = useNow();
  const { decisions, directory } = useAudit(organizationId);
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (scenario === "loading") return <FeedSkeleton label="Carregando decisões de acesso…" columns={DECISION_COLUMNS} filters={4} />;
  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  const change = (next: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setVisible(PAGE_SIZE);
  };

  const subjects = [...new Set(decisions.map(({ subjectUserId }) => subjectUserId))]
    .map((value) => ({ value, label: directory.members[value] ?? `Não é membro (${value.slice(0, 8)}…)` }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const clients = [...new Set(decisions.map(({ clientId }) => clientId))].map((value) => ({
    value,
    label: directory.integrations[value] ?? value,
  }));
  const permission = filters.permission.trim().toLowerCase();

  const filtered = (scenario === "empty" ? [] : decisions).filter(
    (decision) =>
      matchesAllowed(decision, filters.allowed) &&
      (filters.subjectUserId === null || decision.subjectUserId === filters.subjectUserId) &&
      (filters.clientId === null || decision.clientId === filters.clientId) &&
      (permission === "" || decision.results.some((result) => result.permission.includes(permission))) &&
      withinPeriod(decision.decidedAt, filters.period, now),
  );
  const isFiltered =
    filters.allowed !== null || filters.subjectUserId !== null || filters.clientId !== null || permission !== "" || filters.period !== "90d";

  return (
    <div className="flex flex-col gap-4">
      <RetentionNote>
        As respostas dadas às integrações ficam guardadas por 90 dias; depois disso, são apagadas.
      </RetentionNote>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <SingleSelect
          label="Resultado"
          allLabel="Todos os resultados"
          value={filters.allowed}
          options={RESULTS}
          onChange={(allowed) => change({ allowed: allowed as AllowedFilter | null })}
          className="w-full sm:w-44"
        />
        <SingleSelect
          label="Usuário consultado"
          allLabel="Todos os usuários"
          value={filters.subjectUserId}
          options={subjects}
          onChange={(subjectUserId) => change({ subjectUserId })}
        />
        <SingleSelect
          label="Integração"
          allLabel="Todas as integrações"
          value={filters.clientId}
          options={clients}
          onChange={(clientId) => change({ clientId })}
        />
        <InputGroup className="w-full sm:w-52">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            name="decision-permission"
            autoComplete="off"
            aria-label="Permissão pedida"
            placeholder="Permissão, ex.: faturas:aprovar…"
            className="font-mono"
            autoCapitalize="none"
            spellCheck={false}
            value={filters.permission}
            onChange={(event) => change({ permission: event.target.value })}
          />
        </InputGroup>
        <PeriodSelect value={filters.period} options={["24h", "7d", "30d", "90d"]} onChange={(period) => change({ period })} />
      </div>
      {filtered.length === 0 ? (
        <FeedEmpty filtered={isFiltered && scenario !== "empty"} onClear={() => change({ ...INITIAL, period: "90d" })} />
      ) : (
        <>
          <DecisionList decisions={filtered.slice(0, visible)} directory={directory} />
          <LoadMore
            shown={Math.min(visible, filtered.length)}
            total={filtered.length}
            noun={["decisão", "decisões"]}
            onMore={() => setVisible((count) => count + PAGE_SIZE)}
          />
        </>
      )}
    </div>
  );
}
