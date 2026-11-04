"use client";

import { LockIcon } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useOrganizationRoles } from "../hooks/use-organization-roles";
import { GRANT_BLOCK_TEXT } from "./organization-roles";

interface RoleSelectProps {
  id: string;
  organizationId: string;
  viewerIsOwner: boolean;
  value: string;
  onValueChange: (roleId: string) => void;
  invalid?: boolean;
  "aria-describedby"?: string;
}

/**
 * Escolha de papel para convidar ou trocar. Os papéis que o viewer não pode
 * conceder aparecem desabilitados, com o motivo.
 */
export function RoleSelect({
  id,
  organizationId,
  viewerIsOwner,
  value,
  onValueChange,
  invalid,
  "aria-describedby": describedBy,
}: RoleSelectProps) {
  const { roles, grantBlock } = useOrganizationRoles(organizationId, viewerIsOwner);
  const items = roles.map((role) => ({ label: role.name, value: role.id }));

  return (
    <Select items={items} value={value} onValueChange={(next) => next && onValueChange(next)}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid} aria-describedby={describedBy}>
        <SelectValue />
      </SelectTrigger>
      {/* Abaixo do campo e na largura dele: os motivos quebram linha em vez de alargar a lista. */}
      <SelectContent alignItemWithTrigger={false} className="max-w-(--anchor-width)">
        <SelectGroup>
          {roles.map((role) => {
            const block = grantBlock(role);
            return (
              <SelectItem key={role.id} value={role.id} disabled={block !== null} className="data-disabled:opacity-100">
                {block ? (
                  <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {role.name}
                      <LockIcon aria-hidden="true" />
                    </span>
                    <span className="text-xs whitespace-normal text-muted-foreground">{GRANT_BLOCK_TEXT[block]}</span>
                  </span>
                ) : (
                  role.name
                )}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
