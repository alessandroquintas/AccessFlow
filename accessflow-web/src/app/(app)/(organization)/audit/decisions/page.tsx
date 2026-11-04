import type { Metadata } from "next";
import { AuditPage } from "@/presentation/pages/audit/audit-page";

export const metadata: Metadata = { title: "Decisões de acesso" };

export default function Page() {
  return <AuditPage tab="decisions" />;
}
