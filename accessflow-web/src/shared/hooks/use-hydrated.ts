import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false no servidor e na hidratação; true depois. O que depende do navegador
 * (localStorage, fuso, relógio) só vale depois disso.
 */
export const useHydrated = () =>
  useSyncExternalStore(subscribe, () => true, () => false);
