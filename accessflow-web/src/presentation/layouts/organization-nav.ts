import {
  CableIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";

export interface OrganizationNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Sem estas permissões, o item não aparece. */
  permissions: string[];
}

/**
 * Telas da organização ativa, um ícone fixo por conceito
 * (docs/design-direction.md). Os convites da organização ficam como aba de
 * Membros (/members/invitations).
 */
export const ORGANIZATION_NAV: OrganizationNavItem[] = [
  { title: "Visão geral", href: "/overview", icon: LayoutDashboardIcon, permissions: [] },
  { title: "Membros", href: "/members", icon: UsersIcon, permissions: ["members:read"] },
  { title: "Papéis", href: "/roles", icon: ShieldCheckIcon, permissions: ["roles:read"] },
  { title: "Permissões", href: "/permissions", icon: KeyRoundIcon, permissions: ["permissions:manage"] },
  { title: "Integrações", href: "/integrations", icon: CableIcon, permissions: ["integrations:read"] },
  { title: "Auditoria", href: "/audit", icon: ScrollTextIcon, permissions: ["audit:read"] },
  { title: "Configurações", href: "/settings", icon: SettingsIcon, permissions: ["organizations:update"] },
];

/** O item ativo: o próprio endereço ou uma subtela dele (/roles/[roleId]). */
export const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);
