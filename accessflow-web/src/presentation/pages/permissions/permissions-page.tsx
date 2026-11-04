"use client";

import { PermissionsCatalog } from "@/modules/access-control/containers/permissions-catalog";
import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";

export function PermissionsPage() {
  return (
    <CurrentOrganization>
      {(organization) => (
        <>
          <PageHeader
            breadcrumbs={[{ label: organization.name, href: "/overview" }, { label: "Permissões" }]}
            title="Permissões"
            description={
              <>
                As chaves <code className="font-mono text-xs">recurso:ação</code> que os papéis concedem e as integrações
                consultam.
              </>
            }
          />
          <PageBody>
            <RequirePermission organizationId={organization.id} permissions={["roles:read"]}>
              <PermissionsCatalog
                organizationId={organization.id}
                viewerIsOwner={organization.viewerRole.kind === "OWNER"}
              />
            </RequirePermission>
          </PageBody>
        </>
      )}
    </CurrentOrganization>
  );
}
