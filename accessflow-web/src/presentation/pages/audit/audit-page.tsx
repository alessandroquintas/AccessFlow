"use client";

import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { AccessDecisions } from "@/modules/audit/containers/access-decisions";
import { AuditActivity } from "@/modules/audit/containers/audit-activity";
import { SecurityEvents } from "@/modules/audit/containers/security-events";
import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";
import { RouteTabs } from "@/shared/components/layout/route-tabs";

type AuditTab = "activity" | "decisions" | "security";

const TABS = [
  { value: "activity", label: "Atividade", href: "/audit" },
  { value: "decisions", label: "Decisões de acesso", href: "/audit/decisions" },
  { value: "security", label: "Segurança", href: "/audit/security" },
];

/** As três abas exigem audit:read. */
export function AuditPage({ tab }: { tab: AuditTab }) {
  return (
    <CurrentOrganization>
      {(organization) => (
        <>
          <PageHeader
            breadcrumbs={[
              { label: organization.name, href: "/overview" },
              { label: TABS.find(({ value }) => value === tab)?.label ?? "Auditoria" },
            ]}
            title="Auditoria"
            description="Quem mudou o quê na organização, o que as integrações perguntaram e as tentativas negadas."
          />
          <PageBody>
            <RequirePermission organizationId={organization.id} permissions={["audit:read"]}>
              <RouteTabs label="Registros de auditoria" tabs={TABS} current={tab} />
              {tab === "activity" && <AuditActivity organizationId={organization.id} />}
              {tab === "decisions" && <AccessDecisions organizationId={organization.id} />}
              {tab === "security" && <SecurityEvents organizationId={organization.id} />}
            </RequirePermission>
          </PageBody>
        </>
      )}
    </CurrentOrganization>
  );
}
