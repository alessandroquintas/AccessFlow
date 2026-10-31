import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { sessionStore } from "@/infra/mocks/personas";
import { scenarioStore } from "@/infra/mocks/scenario";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  sessionStore.set(sessionStore.initial);
  scenarioStore.set(scenarioStore.initial);
});

// jsdom não implementa matchMedia (usado pela sidebar e pelo tema).
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
