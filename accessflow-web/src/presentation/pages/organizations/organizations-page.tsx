import { CreateOrganizationDialog } from "@/modules/organizations/containers/create-organization-dialog";
import { MyOrganizations } from "@/modules/organizations/containers/my-organizations";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";

export function OrganizationsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Minhas organizações" }]}
        title="Minhas organizações"
        description="As organizações de que você participa e o seu papel em cada uma."
        actions={<CreateOrganizationDialog />}
      />
      <PageBody>
        <MyOrganizations />
      </PageBody>
    </>
  );
}
