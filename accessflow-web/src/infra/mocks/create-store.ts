/**
 * Estado global mínimo e assinável (para useSyncExternalStore), com
 * persistência opcional no localStorage. Só usado pelas ferramentas de design (persona e cenário).
 */
export interface Store<T> {
  get: () => T;
  set: (next: T | ((current: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
  /** Valor do primeiro render (servidor e hidratação). */
  initial: T;
}

export function createStore<T>(initial: T, storageKey?: string): Store<T> {
  let value = initial;
  let hydrated = false;
  const listeners = new Set<() => void>();

  const readStorage = () => {
    if (hydrated || !storageKey || typeof window === "undefined") return;
    hydrated = true;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) value = { ...initial, ...JSON.parse(raw) };
    } catch {
      // Storage indisponível ou valor corrompido: fica o inicial.
    }
  };

  return {
    initial,
    get: () => {
      readStorage();
      return value;
    },
    set: (next) => {
      readStorage();
      value =
        typeof next === "function" ? (next as (current: T) => T)(value) : next;
      if (storageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(value));
        } catch {
          // Sem persistência: segue só em memória.
        }
      }
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
