"use client";

import { useId, useState } from "react";
import { ScopeChecklist } from "../components/create-integration-dialog";
import type { CreateIntegrationForm } from "../schemas";

/**
 * Os escopos com a trava de anti-escalada, para a /design: nenhuma persona
 * tem integrations:manage sem members:read ou roles:read.
 */
export function ScopeChecklistSample({ viewerPermissions }: { viewerPermissions: string[] }) {
  const id = useId();
  const [value, setValue] = useState<CreateIntegrationForm["scopes"]>(["accessflow-api/members.read"]);
  return <ScopeChecklist value={value} onChange={setValue} viewerPermissions={viewerPermissions} idPrefix={id} />;
}
