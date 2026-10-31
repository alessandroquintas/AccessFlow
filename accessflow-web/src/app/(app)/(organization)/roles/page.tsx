import type { Metadata } from "next";
import { OrganizationPlaceholderPage } from "@/presentation/pages/organization/organization-placeholder-page";

export const metadata: Metadata = { title: "Papéis" };

export default function Page() {
  return <OrganizationPlaceholderPage title="Papéis" permissions={["roles:read"]} part={4} />;
}
