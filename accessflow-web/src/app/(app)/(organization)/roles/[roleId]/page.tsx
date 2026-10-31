import type { Metadata } from "next";
import { OrganizationPlaceholderPage } from "@/presentation/pages/organization/organization-placeholder-page";

export const metadata: Metadata = { title: "Papel" };

export default function Page() {
  return <OrganizationPlaceholderPage title="Papel" permissions={["roles:read"]} part={4} />;
}
