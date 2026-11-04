import { describe, expect, it } from "vitest";
import { customPermissionKeySchema } from ".";

const errorOf = (key: string) => customPermissionKeySchema.safeParse(key).error?.issues[0]?.message;

describe("chave de permissão personalizada", () => {
  it("aceita recurso:ação com minúsculas, dígitos e hífen", () => {
    expect(customPermissionKeySchema.safeParse("faturas:aprovar").success).toBe(true);
    expect(customPermissionKeySchema.safeParse("nota-fiscal2:emitir-lote").success).toBe(true);
    expect(customPermissionKeySchema.safeParse(`${"a".repeat(40)}:${"b".repeat(40)}`).success).toBe(true);
  });

  it("explica o formato quando falta ou sobra dois-pontos", () => {
    expect(errorOf("faturas")).toBe("Use o formato recurso:ação, com um dois-pontos entre os dois.");
    expect(errorOf("a:b:c")).toBe("Use o formato recurso:ação, com um dois-pontos entre os dois.");
  });

  it("recusa maiúsculas, acento e espaço", () => {
    expect(errorOf("Faturas:aprovar")).toBe("Use só letras minúsculas, dígitos e hífen, sem acento nem espaço.");
    expect(errorOf("relatórios:exportar")).toBe("Use só letras minúsculas, dígitos e hífen, sem acento nem espaço.");
  });

  it("exige que o recurso e a ação comecem por letra e tenham até 40 caracteres", () => {
    expect(errorOf("2faturas:aprovar")).toBe("O recurso deve começar por letra.");
    expect(errorOf("faturas:-aprovar")).toBe("A ação deve começar por letra.");
    expect(errorOf(`faturas:${"a".repeat(41)}`)).toBe("A ação tem no máximo 40 caracteres.");
  });

  it("recusa os recursos do sistema com mensagem própria", () => {
    for (const resource of ["organizations", "members", "invitations", "roles", "permissions", "audit", "integrations"]) {
      expect(errorOf(`${resource}:exportar`)).toBe(
        `“${resource}” é um recurso do sistema. Escolha outro nome para o recurso.`,
      );
    }
  });
});
