"use client";

import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { OrganizationOverview } from "@/modules/organizations/containers/organization-overview";

export function OverviewPage() {
  return <CurrentOrganization>{(organization) => <OrganizationOverview organization={organization} />}</CurrentOrganization>;
}
