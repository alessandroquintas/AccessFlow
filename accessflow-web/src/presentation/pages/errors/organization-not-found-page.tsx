import { Building2Icon } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";

/** Dentro do shell: organização inexistente ou de que a pessoa não é membro. */
export function OrganizationNotFoundPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Minhas organizações", href: "/organizations" }, { label: "Não encontrada" }]}
        title="Organização não encontrada"
      />
      <PageBody>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>Não encontramos esta organização</EmptyTitle>
            <EmptyDescription>
              Ela não existe ou você não faz parte dela. Se esperava ter acesso, peça um convite a um OWNER.
            </EmptyDescription>
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
