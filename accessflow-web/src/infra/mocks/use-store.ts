import { useSyncExternalStore } from "react";
import type { Store } from "./create-store";

export const useStore = <T,>(store: Store<T>) =>
  useSyncExternalStore(store.subscribe, store.get, () => store.initial);
