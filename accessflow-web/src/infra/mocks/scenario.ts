import { usePathname } from "next/navigation";
import type { ApiErrorCode } from "@/shared/lib/api-errors";
import { createStore } from "./create-store";
import { useStore } from "./use-store";

/**
 * Cenário de design: força um estado na tela atual (carregando, vazio, erro
 * ou sem permissão) para revisar cada um sem precisar de dados reais.
 */
export type ScenarioMode = "normal" | "loading" | "empty" | "error" | "forbidden";

export interface Scenario {
  mode: ScenarioMode;
  /** O cenário vale só para a tela em que foi ligado. */
  pathname: string | null;
  /** Ligado: as ações (convidar, remover…) recebem um erro da API. Vale para todas as telas. */
  failActions: boolean;
}

export const scenarioStore = createStore<Scenario>({
  mode: "normal",
  pathname: null,
  failActions: false,
});

export const setScenario = (mode: ScenarioMode, pathname: string) =>
  scenarioStore.set((scenario) => ({
    ...scenario,
    mode,
    pathname: mode === "normal" ? null : pathname,
  }));

export const setFailActions = (failActions: boolean) =>
  scenarioStore.set((scenario) => ({ ...scenario, failActions }));

/** O cenário ligado para a tela atual. */
export function useScenario(): ScenarioMode {
  const pathname = usePathname();
  const { mode, pathname: target } = useStore(scenarioStore);
  return target === pathname ? mode : "normal";
}

const attempts = new Map<string, number>();

/**
 * Ação de fachada: devolve o erro que a API mandaria, se a simulação estiver
 * ligada; senão, null (sucesso). Com vários códigos possíveis, cada tentativa
 * devolve o próximo, para revisar todas as mensagens da ação. Fase 11b:
 * some, e o erro vem da mutation.
 */
export const mockActionError = (...codes: [ApiErrorCode, ...ApiErrorCode[]]): ApiErrorCode | null => {
  if (!scenarioStore.get().failActions) return null;
  const id = codes.join();
  const attempt = attempts.get(id) ?? 0;
  attempts.set(id, attempt + 1);
  return codes[attempt % codes.length];
};
