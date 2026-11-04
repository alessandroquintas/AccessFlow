import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableSkeleton } from "./skeletons";

describe("skeleton", () => {
  it("anima só com movimento permitido: com prefers-reduced-motion fica o bloco estático", () => {
    const { container } = render(<TableSkeleton columns={[{ label: "Nome" }, { label: "Papel", cell: "badge" }]} rows={2} />);
    const bars = container.querySelectorAll("[data-slot=skeleton]");

    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      const classes = bar.className.split(" ");
      // Brilho e animação só sob `motion-safe:` (prefers-reduced-motion: no-preference).
      expect(classes).toContain("motion-safe:animate-shimmer");
      expect(classes).toContain("motion-safe:skeleton-shimmer");
      expect(classes.filter((name) => name.startsWith("animate-"))).toEqual([]);
      expect(classes).toContain("bg-muted");
    }
  });

  it("as barras ficam fora da árvore de acessibilidade", () => {
    const { container } = render(<TableSkeleton columns={[{ label: "Nome" }]} rows={1} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
