import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sessionStore } from "@/infra/mocks/personas";
import { scenarioStore } from "@/infra/mocks/scenario";
import { renderWithProviders } from "@/test/render";
import { integrationsStore } from "../hooks/use-integrations";
import { Integrations } from "./integrations";

vi.mock("next/navigation", () => ({
  usePathname: () => "/integrations",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("segredo da integração", () => {
  it("depois de fechar, o segredo não fica em store, localStorage nem na página", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Integrations organizationId="org-vale-verde" viewerName="Helena Duarte" />);

    await user.click(screen.getByRole("button", { name: "Criar integração" }));
    const form = await screen.findByRole("dialog", { name: "Criar integração" });
    await user.type(within(form).getByLabelText("Nome"), "ERP de teste");
    await user.click(within(form).getByRole("checkbox", { name: /authorize/ }));
    await user.click(within(form).getByRole("button", { name: "Criar integração" }));

    const secretDialog = await screen.findByRole("dialog", { name: /ERP de teste criada/ });
    await user.click(within(secretDialog).getByRole("button", { name: "Mostrar" }));
    const secret = within(secretDialog).getByText(/^DEMO-nao-e-um-segredo-real-/).textContent ?? "";
    expect(secret.length).toBeGreaterThan(30);

    await user.click(within(secretDialog).getByRole("checkbox", { name: "Copiei e guardei o segredo" }));
    await user.click(within(secretDialog).getByRole("button", { name: "Concluir" }));

    await waitFor(() => expect(screen.queryByText(secret)).not.toBeInTheDocument());
    // A integração entrou na lista, sem o segredo.
    expect(screen.getAllByText("ERP de teste").length).toBeGreaterThan(0);
    for (const store of [integrationsStore, sessionStore, scenarioStore]) {
      expect(JSON.stringify(store.get())).not.toContain(secret);
    }
    const storage = Object.keys(window.localStorage).map((key) => window.localStorage.getItem(key)).join();
    expect(storage).not.toContain(secret);
    expect(document.body.innerHTML).not.toContain(secret);
  });
});
