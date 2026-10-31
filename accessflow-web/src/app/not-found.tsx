import type { Metadata } from "next";
import { NotFoundPage } from "@/presentation/pages/errors/not-found-page";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return <NotFoundPage />;
}
