import type { Metadata } from "next";
import { RolesPage } from "@/presentation/pages/roles/roles-page";

export const metadata: Metadata = { title: "Papéis" };

export default function Page() {
  return <RolesPage />;
}
