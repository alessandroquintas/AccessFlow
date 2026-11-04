import type { Member, MemberFilters } from "../schemas";

/** Sem acento e em minúsculas: "Letícia" encontra "leticia". */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Busca por nome ou e-mail e filtro por papel, sobre a lista já carregada. */
export function filterMembers(members: Member[], { query, roleId }: MemberFilters) {
  const needle = fold(query);
  return members.filter(
    (member) =>
      (roleId === null || member.role.id === roleId) &&
      (needle === "" || fold(member.name).includes(needle) || fold(member.email).includes(needle)),
  );
}

/**
 * O membro é o único OWNER? Só estado de tela, tirado da lista: a API decide
 * de novo (LAST_OWNER).
 */
export const isLastOwner = (members: Member[], userId: string) => {
  const owners = members.filter((member) => member.role.kind === "OWNER");
  return owners.length === 1 && owners[0].userId === userId;
};
