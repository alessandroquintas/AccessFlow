import type { Metadata } from "next";
import { OnboardingPage } from "@/presentation/pages/onboarding/onboarding-page";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default function Page() {
  return <OnboardingPage />;
}
