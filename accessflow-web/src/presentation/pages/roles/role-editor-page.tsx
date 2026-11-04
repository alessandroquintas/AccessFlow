"use client";

import { useParams } from "next/navigation";
import { PermissionCheck } from "@/modules/access-control/containers/permission-check";
import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { RoleEditor } from "@/modules/access-control/containers/role-editor";
import { RoleMembersPreview } from "@/modules/members/containers/role-members-preview";
import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";

/** /roles/new (criar, exige roles:manage) e /roles/[roleId] (ver com roles:read; editar com roles:manage). */
export function RoleEditorPage({ mode }: { mode: "new" | "edit" }) {
  const params = useParams<{ roleId?: string }>();
  const roleId = mode === "edit" ? (params.roleId ?? null) : null;

  return (
    <CurrentOrganization>
      {(organization) => (
        <RequirePermission
          organizationId={organization.id}
          permissions={mode === "new" ? ["roles:manage"] : ["roles:read"]}
          fallback={
            // Sem permissão, o cabeçalho continua (o estado vem no corpo).
            (state) => (
              <>
                <PageHeader
                  breadcrumbs={[{ label: organization.name, href: "/overview" }, { label: "Papéis", href: "/roles" }]}
                  title={mode === "new" ? "Novo papel" : "Papel"}
                />
                <PageBody>{state}</PageBody>
              </>
            )
          }
        >
          <PermissionCheck organizationId={organization.id}>
            {(can) => (
              <RoleEditor
                organizationId={organization.id}
                organizationName={organization.name}
                viewerIsOwner={organization.viewerRole.kind === "OWNER"}
                roleId={roleId}
                renderMembers={(role) => (
                  <RoleMembersPreview
                    organizationId={organization.id}
                    roleId={role.id}
                    roleName={role.name}
                    canSeeMembers={can("members:read")}
                    memberCount={role.memberCount}
                  />
                )}
              />
            )}
          </PermissionCheck>
        </RequirePermission>
      )}
    </CurrentOrganization>
  );
}
