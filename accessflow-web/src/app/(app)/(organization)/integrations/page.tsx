import type { Metadata } from "next";
import { IntegrationsPage } from "@/presentation/pages/integrations/integrations-page";

export const metadata: Metadata = { title: "Integrações" };

export default function Page() {
  return <IntegrationsPage />;
}
