"use client";

import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { CreateRoleAction, RolesList } from "@/modules/access-control/containers/roles-list";
import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";

export function RolesPage() {
  return (
    <CurrentOrganization>
      {(organization) => {
        const viewerIsOwner = organization.viewerRole.kind === "OWNER";
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: organization.name, href: "/overview" }, { label: "Papéis" }]}
              title="Papéis"
              description="Cada papel agrupa as permissões de uma função. Todo membro tem exatamente um papel."
              actions={<CreateRoleAction organizationId={organization.id} viewerIsOwner={viewerIsOwner} />}
            />
            <PageBody>
              <RequirePermission organizationId={organization.id} permissions={["roles:read"]}>
                <RolesList organizationId={organization.id} viewerIsOwner={viewerIsOwner} />
              </RequirePermission>
            </PageBody>
          </>
        );
      }}
    </CurrentOrganization>
  );
}
