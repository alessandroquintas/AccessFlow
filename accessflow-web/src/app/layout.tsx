import type { Metadata } from "next";
import { RootLayout } from "@/presentation/layouts/root-layout";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AccessFlow", template: "%s | AccessFlow" },
  description: "Papéis, permissões e registro de acesso das organizações.",
};

export default function Layout({ children }: LayoutProps<"/">) {
  return <RootLayout>{children}</RootLayout>;
}
