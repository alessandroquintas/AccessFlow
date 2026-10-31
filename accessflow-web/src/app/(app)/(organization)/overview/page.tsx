import type { Metadata } from "next";
import { OrganizationPlaceholderPage } from "@/presentation/pages/organization/organization-placeholder-page";

export const metadata: Metadata = { title: "Visão geral" };

export default function Page() {
  return <OrganizationPlaceholderPage title="Visão geral" permissions={[]} part={3} />;
}
