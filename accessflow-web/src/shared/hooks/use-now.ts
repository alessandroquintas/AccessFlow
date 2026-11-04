import { useSyncExternalStore } from "react";

let now = Date.now();

const subscribe = (onChange: () => void) => {
  now = Date.now();
  const id = setInterval(() => {
    now = Date.now();
    onChange();
  }, 60_000);
  return () => clearInterval(id);
};

/**
 * O relógio, atualizado a cada minuto; null no servidor e na hidratação
 * (lá o "agora" é outro). Para destaques que dependem do tempo, como um
 * convite perto de vencer.
 */
export const useNow = () => useSyncExternalStore(subscribe, () => now, () => null);
