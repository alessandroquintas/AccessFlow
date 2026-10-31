"use client";

import { ConstructionIcon } from "lucide-react";
import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";

interface OrganizationPlaceholderPageProps {
  title: string;
  permissions: string[];
  part: number;
}

/** Rota da organização cujo conteúdo chega numa parte seguinte da fase. */
export function OrganizationPlaceholderPage({ title, permissions, part }: OrganizationPlaceholderPageProps) {
  return (
    <CurrentOrganization>
      {(organization) => (
        <>
          <PageHeader
            breadcrumbs={[{ label: organization.name, href: "/overview" }, { label: title }]}
            title={title}
          />
          <PageBody>
            <RequirePermission organizationId={organization.id} permissions={permissions}>
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ConstructionIcon />
                  </EmptyMedia>
                  <EmptyTitle>Esta tela entra na Parte {part}</EmptyTitle>
                  <EmptyDescription>
                    A rota, o menu e o controle por permissão já funcionam; o conteúdo vem depois.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </RequirePermission>
          </PageBody>
        </>
      )}
    </CurrentOrganization>
  );
}
