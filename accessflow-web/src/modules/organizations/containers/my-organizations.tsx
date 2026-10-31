"use client";

import { Building2Icon } from "lucide-react";
import { usePathname } from "next/navigation";
import { setActiveOrganization } from "@/infra/mocks/personas";
import { setScenario, useScenario } from "@/infra/mocks/scenario";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { OrganizationCardList, OrganizationCardListSkeleton } from "../components/organization-card-list";
import { useMyOrganizations } from "../hooks/use-my-organizations";
import { CreateOrganizationDialog } from "./create-organization-dialog";

export function MyOrganizations() {
  const pathname = usePathname();
  const scenario = useScenario();
  const organizations = useMyOrganizations();

  if (scenario === "loading") return <OrganizationCardListSkeleton />;
  if (scenario === "error") return <ErrorState onRetry={() => setScenario("normal", pathname)} />;

  if (scenario === "empty" || organizations.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2Icon />
          </EmptyMedia>
          <EmptyTitle>Você ainda não participa de nenhuma organização</EmptyTitle>
          <EmptyDescription>
            Crie uma organização para começar, ou aceite um convite em Meus convites.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <CreateOrganizationDialog />
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <OrganizationCardList
      organizations={organizations}
      onOpen={(organization) => setActiveOrganization(organization.id)}
    />
  );
}
