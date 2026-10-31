import type { Metadata } from "next";
import { ProfilePage } from "@/presentation/pages/profile/profile-page";

export const metadata: Metadata = { title: "Perfil" };

export default function Page() {
  return <ProfilePage />;
}
