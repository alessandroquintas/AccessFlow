import type { Metadata } from "next";
import { OrganizationsPage } from "@/presentation/pages/organizations/organizations-page";

export const metadata: Metadata = { title: "Minhas organizações" };

export default function Page() {
  return <OrganizationsPage />;
}
