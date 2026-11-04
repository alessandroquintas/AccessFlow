import type { Metadata } from "next";
import { SettingsPage } from "@/presentation/pages/settings/settings-page";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return <SettingsPage />;
}
