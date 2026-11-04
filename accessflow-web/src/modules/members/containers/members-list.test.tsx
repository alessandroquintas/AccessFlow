import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { MembersList } from "./members-list";

vi.mock("next/navigation", () => ({
  usePathname: () => "/members",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

async function openOwnMenu(organizationId: string) {
  const user = userEvent.setup();
  renderWithProviders(
    <MembersList organizationId={organizationId} organizationName="Organização" viewerIsOwner />,
  );
  // A tabela e a lista do celular existem lado a lado (o CSS escolhe); a primeira é a tabela.
  await user.click(screen.getAllByRole("button", { name: "Suas ações nesta organização" })[0]);
  return {
    leave: await screen.findByRole("menuitem", { name: /Sair da organização/ }),
    changeRole: screen.getByRole("menuitem", { name: /Trocar papel/ }),
  };
}

describe("último OWNER", () => {
  it("sem outro OWNER, sair e trocar o próprio papel ficam desabilitados, com o motivo", async () => {
    const { leave, changeRole } = await openOwnMenu("org-vale-verde");

    expect(leave).toHaveAttribute("aria-disabled", "true");
    expect(changeRole).toHaveAttribute("aria-disabled", "true");
    expect(leave).toHaveTextContent("É preciso haver outro OWNER antes.");
  });

  it("com outro OWNER, as duas ações ficam disponíveis", async () => {
    const { leave, changeRole } = await openOwnMenu("org-atlantico");

    expect(leave).not.toHaveAttribute("aria-disabled");
    expect(changeRole).not.toHaveAttribute("aria-disabled");
  });
});
