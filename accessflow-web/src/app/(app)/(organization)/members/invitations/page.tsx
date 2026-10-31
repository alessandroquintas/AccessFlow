import type { Metadata } from "next";
import { OrganizationPlaceholderPage } from "@/presentation/pages/organization/organization-placeholder-page";

export const metadata: Metadata = { title: "Convites" };

export default function Page() {
  return <OrganizationPlaceholderPage title="Convites" permissions={["members:invite"]} part={3} />;
}
