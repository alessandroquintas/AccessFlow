import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sessionStore } from "@/infra/mocks/personas";
import { scenarioStore } from "@/infra/mocks/scenario";
import { Can } from "@/modules/access-control/containers/can";
import { renderWithProviders } from "@/test/render";
import { DevToolbar } from "./dev-toolbar";

vi.mock("next/navigation", () => ({ usePathname: () => "/members" }));

describe("seletor de persona", () => {
  it("troca a persona e a interface reage às novas permissões", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <DevToolbar />
        <Can organizationId="org-vale-verde" permissions={["members:invite"]}>
          <button type="button">Convidar membro</button>
        </Can>
      </>,
    );

    expect(screen.getByRole("button", { name: "Convidar membro" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Persona: OWNER/ }));
    await user.click(await screen.findByRole("radio", { name: /MEMBER/ }));

    expect(sessionStore.get().personaId).toBe("member");
    expect(screen.getByRole("button", { name: /Persona: MEMBER/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convidar membro" })).not.toBeInTheDocument();
  });

  it("liga o cenário só para a tela atual", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DevToolbar />);

    await user.click(screen.getByRole("button", { name: /Persona/ }));
    await user.click(await screen.findByRole("button", { name: "Erro" }));

    expect(scenarioStore.get()).toEqual({ mode: "error", pathname: "/members" });
  });
});
