import { createStore } from "@/infra/mocks/create-store";
import type { OrganizationRole, PermissionDefinition } from "../schemas";

/**
 * Papéis e permissões personalizadas alterados nesta sessão de design, por
 * organização, para as telas refletirem a ação enquanto a página está
 * aberta. Organização ausente: vale a fixture. Fase 11b: some (o cache é
 * invalidado após cada mutation).
 */
export const catalogStore = createStore<{
  roles: Record<string, OrganizationRole[]>;
  permissions: Record<string, PermissionDefinition[]>;
}>({ roles: {}, permissions: {} });
