import type { Metadata } from "next";
import { PermissionsPage } from "@/presentation/pages/permissions/permissions-page";

export const metadata: Metadata = { title: "Permissões" };

export default function Page() {
  return <PermissionsPage />;
}
