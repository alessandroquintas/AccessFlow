import { describe, expect, it } from "vitest";
import { MEMBERS } from "../fixtures/members";
import { filterMembers, isLastOwner } from "./members";

const valeVerde = MEMBERS["org-vale-verde"];
const names = (members: typeof valeVerde) => members.map(({ name }) => name);

describe("busca e filtro de membros", () => {
  it("busca pelo nome sem diferenciar acento nem maiúsculas", () => {
    expect(names(filterMembers(valeVerde, { query: "LETICIA", roleId: null }))).toEqual(["Letícia Fontes"]);
  });

  it("busca também pelo e-mail", () => {
    expect(names(filterMembers(valeVerde, { query: "bruno.cardoso@", roleId: null }))).toEqual(["Bruno Cardoso"]);
  });

  it("combina a busca com o filtro de papel", () => {
    const auditoria = filterMembers(valeVerde, { query: "", roleId: "role-vv-audit" });
    expect(names(auditoria)).toEqual(["Isabela Rocha", "Bruno Cardoso", "Larissa Viana"]);
    expect(names(filterMembers(valeVerde, { query: "bruno", roleId: "role-vv-finance" }))).toEqual([]);
  });

  it("sem busca nem filtro, devolve todos", () => {
    expect(filterMembers(valeVerde, { query: "  ", roleId: null })).toHaveLength(37);
  });
});

describe("último OWNER", () => {
  it("é o único OWNER da organização", () => {
    expect(isLastOwner(valeVerde, "u-helena")).toBe(true);
    expect(isLastOwner(MEMBERS["org-atlantico"], "u-helena")).toBe(false);
  });

  it("quem não é OWNER nunca é o último", () => {
    expect(isLastOwner(valeVerde, "u-camila")).toBe(false);
  });
});
