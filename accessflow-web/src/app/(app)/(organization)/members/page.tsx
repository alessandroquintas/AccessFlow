import type { Metadata } from "next";
import { OrganizationPlaceholderPage } from "@/presentation/pages/organization/organization-placeholder-page";

export const metadata: Metadata = { title: "Membros" };

export default function Page() {
  return <OrganizationPlaceholderPage title="Membros" permissions={["members:read"]} part={3} />;
}
