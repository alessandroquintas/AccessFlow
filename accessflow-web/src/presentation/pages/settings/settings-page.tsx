"use client";

import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { OrganizationSettings } from "@/modules/organizations/containers/organization-settings";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";

export function SettingsPage() {
  return (
    <CurrentOrganization>
      {(organization) => (
        <>
          <PageHeader
            breadcrumbs={[{ label: organization.name, href: "/overview" }, { label: "Configurações" }]}
            title="Configurações"
            description="Os dados da organização que aparecem para os membros e nas integrações."
          />
          <PageBody>
            <RequirePermission organizationId={organization.id} permissions={["organizations:update"]}>
              <OrganizationSettings organization={organization} />
            </RequirePermission>
          </PageBody>
        </>
      )}
    </CurrentOrganization>
  );
}
