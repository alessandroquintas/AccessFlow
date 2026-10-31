import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCallback } from "@/modules/auth/containers/auth-callback";

export const metadata: Metadata = { title: "Entrando" };

export default function Page() {
  return (
    <Suspense>
      <AuthCallback />
    </Suspense>
  );
}
