import { OrganizationGate } from "@/modules/organizations/containers/organization-gate";

/** Telas da organização ativa (escolhida no seletor da sidebar). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <OrganizationGate>{children}</OrganizationGate>;
}
