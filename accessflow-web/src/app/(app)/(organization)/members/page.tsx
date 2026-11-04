import type { Metadata } from "next";
import { MembersPage } from "@/presentation/pages/members/members-page";

export const metadata: Metadata = { title: "Membros" };

export default function Page() {
  return <MembersPage tab="members" />;
}
