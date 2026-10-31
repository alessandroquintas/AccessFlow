import { usePathname } from "next/navigation";
import { createStore } from "./create-store";
import { useStore } from "./use-store";

/**
 * Cenário de design: força um estado na tela atual (carregando, vazio ou
 * erro) para revisar cada um sem precisar de dados reais.
 */
export type ScenarioMode = "normal" | "loading" | "empty" | "error";

export interface Scenario {
  mode: ScenarioMode;
  /** O cenário vale só para a tela em que foi ligado. */
  pathname: string | null;
}

export const scenarioStore = createStore<Scenario>({
  mode: "normal",
  pathname: null,
});

export const setScenario = (mode: ScenarioMode, pathname: string) =>
  scenarioStore.set({ mode, pathname: mode === "normal" ? null : pathname });

/** O cenário ligado para a tela atual. */
export function useScenario(): ScenarioMode {
  const pathname = usePathname();
  const { mode, pathname: target } = useStore(scenarioStore);
  return target === pathname ? mode : "normal";
}
