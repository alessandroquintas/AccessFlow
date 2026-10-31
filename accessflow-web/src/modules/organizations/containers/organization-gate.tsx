"use client";

import { Building2Icon } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { useCurrentOrganization } from "../hooks/use-my-organizations";

/** Telas da organização: sem nenhuma organização, não há o que mostrar. */
export function OrganizationGate({ children }: { children: React.ReactNode }) {
  const organization = useCurrentOrganization();
  if (organization) return children;

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Organização" }]} title="Nenhuma organização" />
      <PageBody>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>Você ainda não participa de nenhuma organização</EmptyTitle>
            <EmptyDescription>Crie uma organização ou aceite um convite para ver esta tela.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/organizations" />} nativeButton={false}>
              Ver minhas organizações
            </Button>
          </EmptyContent>
        </Empty>
      </PageBody>
    </>
  );
}
