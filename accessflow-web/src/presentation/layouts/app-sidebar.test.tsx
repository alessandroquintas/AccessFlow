import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setPersona } from "@/infra/mocks/personas";
import { SidebarProvider } from "@/shared/components/ui/sidebar";
import { renderWithProviders } from "@/test/render";
import { AppSidebar } from "./app-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/members",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const organizationMenu = () => {
  const group = screen.getByText("Organização").closest("[data-sidebar=group]") as HTMLElement;
  return within(group)
    .getAllByRole("link")
    .map((link) => link.textContent);
};

const renderSidebar = () =>
  renderWithProviders(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>,
  );

describe("menu da organização ativa", () => {
  it("OWNER vê todos os itens", () => {
    renderSidebar();

    expect(organizationMenu()).toEqual([
      "Visão geral",
      "Membros",
      "Papéis",
      "Permissões",
      "Integrações",
      "Auditoria",
      "Configurações",
    ]);
    expect(screen.getByRole("link", { name: "Membros" })).toHaveAttribute("aria-current", "page");
  });

  it("MEMBER vê só o que members:read permite", () => {
    setPersona("member");
    renderSidebar();

    expect(organizationMenu()).toEqual(["Visão geral", "Membros"]);
  });

  it("papel personalizado vê os itens do papel", () => {
    setPersona("custom");
    renderSidebar();

    expect(organizationMenu()).toEqual(["Visão geral", "Membros", "Papéis", "Integrações", "Auditoria"]);
  });
});

describe("sem organização", () => {
  it("o primeiro acesso não vê o grupo da organização", () => {
    setPersona("first-access");
    renderSidebar();

    expect(screen.queryByText("Organização")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Minhas organizações" })).toBeInTheDocument();
  });
});
