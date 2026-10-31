"use client";

import { Building2Icon, MailIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Can } from "@/modules/access-control/containers/can";
import { UserMenu } from "@/modules/identity/containers/user-menu";
import { PendingInvitationsCount } from "@/modules/invitations/containers/pending-invitations-count";
import { CurrentOrganization } from "@/modules/organizations/containers/current-organization";
import { OrganizationSwitcher } from "@/modules/organizations/containers/organization-switcher";
import { DevToolbar } from "@/presentation/dev/dev-toolbar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/shared/components/ui/sidebar";
import { isActivePath, ORGANIZATION_NAV } from "./organization-nav";

const ACCOUNT_NAV = [
  { title: "Minhas organizações", href: "/organizations", icon: Building2Icon },
  { title: "Meus convites", href: "/invitations", icon: MailIcon },
  { title: "Perfil", href: "/profile", icon: UserIcon },
];

function NavLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType;
  children: React.ReactNode;
}) {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenuButton
      isActive={active}
      tooltip={typeof children === "string" ? children : undefined}
      render={<Link href={href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)} />}
    >
      <Icon />
      <span>{children}</span>
    </SidebarMenuButton>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <OrganizationSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <CurrentOrganization>
          {(organization) => (
            <SidebarGroup>
              <SidebarGroupLabel>Organização</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {ORGANIZATION_NAV.map((item) => (
                    <Can key={item.href} organizationId={organization.id} permissions={item.permissions}>
                      <SidebarMenuItem>
                        <NavLink href={item.href} active={isActivePath(pathname, item.href)} icon={item.icon}>
                          {item.title}
                        </NavLink>
                      </SidebarMenuItem>
                    </Can>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </CurrentOrganization>

        <SidebarGroup>
          <SidebarGroupLabel>Conta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ACCOUNT_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <NavLink href={item.href} active={pathname === item.href} icon={item.icon}>
                    {item.title}
                  </NavLink>
                  {item.href === "/invitations" && (
                    <PendingInvitationsCount>
                      {(count) => (
                        <SidebarMenuBadge aria-label={`${count} pendentes`}>{count}</SidebarMenuBadge>
                      )}
                    </PendingInvitationsCount>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {process.env.NODE_ENV !== "production" && (
            <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
              <Suspense fallback={null}>
                <DevToolbar variant="inline" />
              </Suspense>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
