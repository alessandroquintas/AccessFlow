import type { Metadata } from "next";
import { AuditPage } from "@/presentation/pages/audit/audit-page";

export const metadata: Metadata = { title: "Auditoria" };

export default function Page() {
  return <AuditPage tab="activity" />;
}
