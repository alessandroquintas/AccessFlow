import type { Metadata } from "next";
import { OrganizationPlaceholderPage } from "@/presentation/pages/organization/organization-placeholder-page";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return <OrganizationPlaceholderPage title="Configurações" permissions={["organizations:update"]} part={3} />;
}
