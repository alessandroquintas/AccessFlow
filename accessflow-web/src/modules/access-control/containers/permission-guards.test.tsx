import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setPersona } from "@/infra/mocks/personas";
import { renderWithProviders } from "@/test/render";
import { Can } from "./can";
import { RequirePermission } from "./require-permission";

const VALE_VERDE = "org-vale-verde";

function Page() {
  return (
    <>
      <Can organizationId={VALE_VERDE} permissions={["members:invite"]}>
        <button type="button">Convidar membro</button>
      </Can>
      <RequirePermission organizationId={VALE_VERDE} permissions={["roles:manage"]}>
        <h1>Editor de papéis</h1>
      </RequirePermission>
    </>
  );
}

describe("guards de permissão", () => {
  it("OWNER vê a ação e a página", () => {
    renderWithProviders(<Page />);

    expect(screen.getByRole("heading", { name: "Editor de papéis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convidar membro" })).toBeInTheDocument();
  });

  it("papel personalizado vê a ação que tem e o estado de sem permissão na página que não tem", () => {
    setPersona("custom");
    renderWithProviders(<Page />);

    expect(screen.getByRole("button", { name: "Convidar membro" })).toBeInTheDocument();
    expect(screen.getByText("Você não tem permissão para ver isto")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Editor de papéis" })).not.toBeInTheDocument();
  });

  it("MEMBER não vê a ação", () => {
    setPersona("member");
    renderWithProviders(<Page />);

    expect(screen.queryByRole("button", { name: "Convidar membro" })).not.toBeInTheDocument();
  });
});
