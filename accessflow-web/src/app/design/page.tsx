import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignPage } from "@/presentation/pages/design/design-page";

export const metadata: Metadata = { title: "Direção visual do AccessFlow" };

export default function Page() {
  // Página de revisão do design system: não existe em produção.
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignPage />;
}
