import type { Metadata } from "next";
import { OrganizationPlaceholderPage } from "@/presentation/pages/organization/organization-placeholder-page";

export const metadata: Metadata = { title: "Integrações" };

export default function Page() {
  return <OrganizationPlaceholderPage title="Integrações" permissions={["integrations:read"]} part={5} />;
}
