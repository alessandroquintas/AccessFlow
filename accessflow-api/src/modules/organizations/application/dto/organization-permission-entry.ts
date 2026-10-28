/** Uma permissão do catálogo efetivo da organização. */
export interface OrganizationPermissionEntry {
  key: string;
  description: string;
  /** Do catálogo de sistema (não pode ser editada nem excluída). */
  isSystem: boolean;
}
