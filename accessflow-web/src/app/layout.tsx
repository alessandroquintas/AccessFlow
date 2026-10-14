import type { Metadata } from "next";
import { RootLayout } from "@/presentation/layouts/root-layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "AccessFlow",
  description: "AccessFlow",
};

export default function Layout({ children }: LayoutProps<"/">) {
  return <RootLayout>{children}</RootLayout>;
}
