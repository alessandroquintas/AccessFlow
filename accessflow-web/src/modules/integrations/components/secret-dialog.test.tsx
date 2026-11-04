import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { CreatedIntegration } from "../schemas";
import { SecretDialog, tokenRequestExample } from "./secret-dialog";

const CREATED: CreatedIntegration = {
  integration: {
    id: "int-teste",
    name: "ERP de teste",
    clientId: "abcdefghijklmnopqrstuvwxyz",
    scopes: ["accessflow-api/authorize"],
    status: "ACTIVE",
    createdBy: null,
    createdAt: "2026-11-01T12:00:00.000Z",
    revokedAt: null,
  },
  clientSecret: "DEMO-nao-e-um-segredo-real-teste",
};

describe("diálogo do segredo", () => {
  it("só fecha depois de marcar que guardou o segredo", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    renderWithProviders(<SecretDialog created={CREATED} tokenEndpoint="https://exemplo/oauth2/token" onDone={onDone} />);

    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    const done = screen.getByRole("button", { name: "Concluir" });
    expect(done).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Copiei e guardei o segredo" }));
    expect(done).toBeEnabled();
    await user.click(done);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("o segredo começa mascarado e o exemplo usa variáveis, nunca o segredo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecretDialog created={CREATED} tokenEndpoint="https://exemplo/oauth2/token" onDone={vi.fn()} />);

    expect(screen.queryByText(CREATED.clientSecret)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(screen.getByText(CREATED.clientSecret)).toBeInTheDocument();

    const example = tokenRequestExample("https://exemplo/oauth2/token", CREATED.integration.scopes);
    expect(example).toContain('-u "$CLIENT_ID:$CLIENT_SECRET"');
    expect(example).not.toContain(CREATED.clientSecret);
    expect(example).not.toContain(CREATED.integration.clientId);
  });
});
