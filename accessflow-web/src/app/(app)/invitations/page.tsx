import type { Metadata } from "next";
import { MyInvitationsPage } from "@/presentation/pages/my-invitations/my-invitations-page";

export const metadata: Metadata = { title: "Meus convites" };

export default function Page() {
  return <MyInvitationsPage />;
}
