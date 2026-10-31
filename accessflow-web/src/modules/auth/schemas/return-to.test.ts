import { describe, expect, it } from "vitest";
import { parseReturnTo } from ".";

describe("caminho de volta depois de entrar", () => {
  it("aceita caminhos da aplicação", () => {
    expect(parseReturnTo("/members")).toBe("/members");
    expect(parseReturnTo("/roles/role-gestor-acesso")).toBe("/roles/role-gestor-acesso");
  });

  it("recusa o que levaria a outro site", () => {
    expect(parseReturnTo("https://exemplo.com")).toBeNull();
    expect(parseReturnTo("//exemplo.com")).toBeNull();
    expect(parseReturnTo("/\\exemplo.com")).toBeNull();
    expect(parseReturnTo(null)).toBeNull();
  });
});
