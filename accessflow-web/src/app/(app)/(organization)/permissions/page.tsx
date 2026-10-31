import type { Metadata } from "next";
import { OrganizationPlaceholderPage } from "@/presentation/pages/organization/organization-placeholder-page";

export const metadata: Metadata = { title: "Permissões" };

export default function Page() {
  return <OrganizationPlaceholderPage title="Permissões" permissions={["permissions:manage"]} part={4} />;
}
