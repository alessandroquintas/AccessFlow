import type { Metadata } from "next";
import { AuditPage } from "@/presentation/pages/audit/audit-page";

export const metadata: Metadata = { title: "Segurança" };

export default function Page() {
  return <AuditPage tab="security" />;
}
