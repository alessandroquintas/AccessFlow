import type { Metadata, Viewport } from "next";
import { RootLayout } from "@/presentation/layouts/root-layout";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AccessFlow", template: "%s · AccessFlow" },
  description: "Papéis, permissões e registro de acesso das organizações.",
};

/** A barra do navegador no celular acompanha o fundo de cada tema (tokens --background). */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1118" },
  ],
};

export default function Layout({ children }: LayoutProps<"/">) {
  return <RootLayout>{children}</RootLayout>;
}
