import type { Metadata } from "next";
import { OrganizationPlaceholderPage } from "@/presentation/pages/organization/organization-placeholder-page";

export const metadata: Metadata = { title: "Auditoria" };

export default function Page() {
  return <OrganizationPlaceholderPage title="Auditoria" permissions={["audit:read"]} part={5} />;
}
