"use client";

import { sessionStore } from "@/infra/mocks/personas";
import { useStore } from "@/infra/mocks/use-store";
import { FIRST_ACCESS_EMAIL, PROFILES } from "../fixtures/profiles";
import type { Profile } from "../schemas";

/** Perfil da persona atual (equivale ao `me`); null antes do onboarding. */
export function useViewerProfile(): { profile: Profile | null; email: string } {
  const { personaId, onboardedName } = useStore(sessionStore);

  if (personaId !== "first-access") {
    const profile = PROFILES[personaId];
    return { profile, email: profile.email };
  }

  return {
    profile: onboardedName
      ? { name: onboardedName, email: FIRST_ACCESS_EMAIL, createdAt: new Date().toISOString() }
      : null,
    email: FIRST_ACCESS_EMAIL,
  };
}
