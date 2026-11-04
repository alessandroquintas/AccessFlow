"use client";

import { useSearchParams } from "next/navigation";
import { Can } from "@/modules/access-control/containers/can";
import { PermissionCheck } from "@/modules/access-control/containers/permission-check";
import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { InviteMemberDialog } from "@/modules/invitations/containers/invite-member-dialog";
import { OrganizationInvitations } from "@/modules/invitations/containers/organization-invitations";
import { MembersList } from "@/modules/members/containers/members-list";
import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";
import { RouteTabs } from "@/shared/components/layout/route-tabs";

type MembersTab = "members" | "invitations";

const TABS: { value: MembersTab; label: string; href: string; permissions: string[] }[] = [
  { value: "members", label: "Membros", href: "/members", permissions: ["members:read"] },
  { value: "invitations", label: "Convites", href: "/members/invitations", permissions: ["members:invite"] },
];

function MembersTabs({ organizationId, current }: { organizationId: string; current: MembersTab }) {
  return (
    <PermissionCheck organizationId={organizationId}>
      {(can) => (
        <RouteTabs
          label="Membros e convites"
          current={current}
          tabs={TABS.filter((tab) => tab.permissions.every((key) => can(key)))}
        />
      )}
    </PermissionCheck>
  );
}

export function MembersPage({ tab }: { tab: MembersTab }) {
  // /members?role=<id>: o link "membros com o papel" de Papéis.
  const roleId = useSearchParams().get("role");

  return (
    <CurrentOrganization>
      {(organization) => {
        const viewerIsOwner = organization.viewerRole.kind === "OWNER";
        const invite = (props: { compact?: boolean }) => (
          <Can organizationId={organization.id} permissions={["members:invite"]}>
            <InviteMemberDialog organizationId={organization.id} viewerIsOwner={viewerIsOwner} {...props} />
          </Can>
        );

        return (
          <>
            <PageHeader
              breadcrumbs={[
                { label: organization.name, href: "/overview" },
                { label: tab === "members" ? "Membros" : "Convites" },
              ]}
              title="Membros"
              description="Quem participa da organização, com que papel, e os convites enviados."
              actions={invite({ compact: true })}
            />
            <PageBody>
              <RequirePermission
                organizationId={organization.id}
                permissions={TABS.find(({ value }) => value === tab)?.permissions ?? []}
              >
                <MembersTabs organizationId={organization.id} current={tab} />
                {tab === "members" ? (
                  <MembersList
                    organizationId={organization.id}
                    organizationName={organization.name}
                    viewerIsOwner={viewerIsOwner}
                    inviteAction={invite({})}
                    initialRoleId={roleId}
                  />
                ) : (
                  <OrganizationInvitations organizationId={organization.id} viewerIsOwner={viewerIsOwner} />
                )}
              </RequirePermission>
            </PageBody>
          </>
        );
      }}
    </CurrentOrganization>
  );
}
