import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { OrganizationForm } from "./organization-form";

function renderForm(onSubmit = vi.fn()) {
  renderWithProviders(
    <>
      <OrganizationForm id="org" onSubmit={onSubmit} />
      <button type="submit" form="org">
        Criar
      </button>
    </>,
  );
  return {
    name: screen.getByLabelText("Nome"),
    slug: screen.getByLabelText("Identificador"),
    onSubmit,
  };
}

describe("formulário de organização", () => {
  it("sugere o identificador a partir do nome, sem acentos", async () => {
    const user = userEvent.setup();
    const { name, slug } = renderForm();

    await user.type(name, "Laboratório Atlântico");

    expect(slug).toHaveValue("laboratorio-atlantico");
  });

  it("para de sugerir depois que a pessoa edita o identificador", async () => {
    const user = userEvent.setup();
    const { name, slug } = renderForm();

    await user.type(name, "Vale");
    await user.clear(slug);
    await user.type(slug, "cooperativa");
    await user.type(name, " Verde");

    expect(slug).toHaveValue("cooperativa");
  });

  it("mostra o erro junto ao campo e não envia", async () => {
    const user = userEvent.setup();
    const { slug, onSubmit } = renderForm();

    await user.type(screen.getByLabelText("Nome"), "AB");
    await user.clear(slug);
    await user.type(slug, "ab--");
    await user.click(screen.getByRole("button", { name: "Criar" }));

    expect(await screen.findByText("Use letras minúsculas, números e hífens entre eles.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
