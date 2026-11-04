"use client";

import { useViewerProfile } from "../hooks/use-viewer-profile";

/** O nome da persona atual (ou o e-mail, antes do onboarding) para quem está fora do módulo. */
export function ViewerName({ children }: { children: (name: string) => React.ReactNode }) {
  const { profile, email } = useViewerProfile();
  return children(profile?.name ?? email);
}
