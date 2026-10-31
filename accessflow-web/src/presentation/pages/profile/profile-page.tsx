import { ProfileSettings } from "@/modules/identity/containers/profile-settings";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";

export function ProfilePage() {
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Perfil" }]} title="Perfil" />
      <PageBody>
        <ProfileSettings />
      </PageBody>
    </>
  );
}
