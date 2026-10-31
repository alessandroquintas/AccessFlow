import { MyInvitations } from "@/modules/invitations/containers/my-invitations";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";

export function MyInvitationsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Meus convites" }]}
        title="Meus convites"
        description="Convites enviados para o seu e-mail. Ao aceitar, você entra na organização com o papel indicado."
      />
      <PageBody>
        <MyInvitations />
      </PageBody>
    </>
  );
}
