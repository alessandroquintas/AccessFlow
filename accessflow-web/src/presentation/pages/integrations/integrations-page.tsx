"use client";

import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { ViewerName } from "@/modules/identity/containers/viewer-name";
import { Integrations } from "@/modules/integrations/containers/integrations";
import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";

export function IntegrationsPage() {
  return (
    <CurrentOrganization>
      {(organization) => (
        <>
          <PageHeader
            breadcrumbs={[{ label: organization.name, href: "/overview" }, { label: "Integrações" }]}
            title="Integrações"
            description="Sistemas que consultam o AccessFlow pela API, com credenciais próprias e escopos limitados."
          />
          <PageBody>
            <RequirePermission organizationId={organization.id} permissions={["integrations:read"]}>
              <ViewerName>
                {(name) => <Integrations organizationId={organization.id} viewerName={name} />}
              </ViewerName>
            </RequirePermission>
          </PageBody>
        </>
      )}
    </CurrentOrganization>
  );
}
