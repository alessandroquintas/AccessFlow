import type { Metadata } from "next";
import { RoleEditorPage } from "@/presentation/pages/roles/role-editor-page";

export const metadata: Metadata = { title: "Novo papel" };

export default function Page() {
  return <RoleEditorPage mode="new" />;
}
