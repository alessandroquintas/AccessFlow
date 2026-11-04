"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Can } from "@/modules/access-control/containers/can";
import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { InviteMemberDialog } from "@/modules/invitations/containers/invite-member-dialog";
import { OrganizationInvitations } from "@/modules/invitations/containers/organization-invitations";
import { MembersList } from "@/modules/members/containers/members-list";
import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";
import { cn } from "@/shared/lib/utils";

type MembersTab = "members" | "invitations";

const TABS: { value: MembersTab; label: string; href: string; permissions: string[] }[] = [
  { value: "members", label: "Membros", href: "/members", permissions: ["members:read"] },
  { value: "invitations", label: "Convites", href: "/members/invitations", permissions: ["members:invite"] },
];

/**
 * Abas de navegação: cada uma é uma rota (dá para abrir e compartilhar o
 * endereço), então são links com aria-current, não o componente Tabs.
 */
function MembersTabs({ organizationId, current }: { organizationId: string; current: MembersTab }) {
  return (
    <nav aria-label="Membros e convites" className="border-b">
      <ul className="-mb-px flex gap-4">
        {TABS.map((tab) => (
          <Can key={tab.value} organizationId={organizationId} permissions={tab.permissions}>
            <li>
              <Link
                href={tab.href}
                aria-current={tab.value === current ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center border-b-2 border-transparent px-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring",
                  tab.value === current && "border-primary text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          </Can>
        ))}
      </ul>
    </nav>
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
