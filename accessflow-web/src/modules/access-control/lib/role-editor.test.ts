import { describe, expect, it } from "vitest";
import { diffPermissions, formatDiff, permissionLock, toggleGroup } from "./role-editor";

describe("resumo de mudanças", () => {
  it("separa adicionadas e removidas, ignorando a ordem", () => {
    const diff = diffPermissions(
      ["members:read", "audit:read", "faturas:aprovar"],
      ["faturas:aprovar", "members:read", "roles:read", "members:invite"],
    );

    expect(diff).toEqual({ added: ["roles:read", "members:invite"], removed: ["audit:read"] });
    expect(formatDiff(diff)).toBe("+2, −1");
  });

  it("mostra só o lado que mudou, ou nenhuma mudança", () => {
    expect(formatDiff(diffPermissions(["members:read"], []))).toBe("−1");
    expect(formatDiff(diffPermissions(["members:read"], ["members:read"]))).toBe("Sem mudanças");
  });
});

describe("travamento no editor", () => {
  const viewerPermissions = ["members:read", "roles:read", "roles:manage"];
  const editing = { roleKind: "CUSTOM" as const, canManage: true, viewerPermissions };

  it("trava a permissão que o viewer não tem e libera a que ele tem", () => {
    expect(permissionLock("faturas:aprovar", editing)).toBe("escalation");
    expect(permissionLock("members:read", editing)).toBeNull();
  });

  it("a travada fica como está, marcada ou desmarcada, ao selecionar ou limpar o grupo", () => {
    const isLocked = (key: string) => permissionLock(key, editing) !== null;
    const group = ["members:read", "members:invite", "members:remove"];

    // members:invite já estava no papel (marcada e travada); members:remove não (desmarcada e travada).
    expect(toggleGroup(["members:invite"], group, isLocked, true).toSorted()).toEqual(["members:invite", "members:read"]);
    expect(toggleGroup(["members:invite", "members:read"], group, isLocked, false)).toEqual(["members:invite"]);
  });

  it("no OWNER e sem roles:manage, tudo fica travado", () => {
    expect(permissionLock("members:read", { ...editing, roleKind: "OWNER" })).toBe("owner");
    expect(permissionLock("members:read", { ...editing, canManage: false })).toBe("read-only");
  });
});
