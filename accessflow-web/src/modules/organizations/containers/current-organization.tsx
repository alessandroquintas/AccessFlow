"use client";

import { useCurrentOrganization } from "../hooks/use-my-organizations";
import type { Organization } from "../schemas";

interface CurrentOrganizationProps {
  children: (organization: Organization) => React.ReactNode;
  /** Quando a pessoa não tem organização. */
  fallback?: React.ReactNode;
}

/** Entrega a organização ativa para quem está fora do módulo. */
export function CurrentOrganization({ children, fallback = null }: CurrentOrganizationProps) {
  const organization = useCurrentOrganization();
  return organization ? children(organization) : fallback;
}
