"use client";

import { CheckIcon, ChevronsUpDownIcon, LayoutGridIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setActiveOrganization } from "@/infra/mocks/personas";
import { LogoMark } from "@/shared/components/brand/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/shared/components/ui/sidebar";
import { useCurrentOrganization, useMyOrganizations } from "../hooks/use-my-organizations";

/** Telas da conta: trocar de organização a partir delas leva à visão geral. */
const ACCOUNT_PATHS = ["/organizations", "/invitations", "/profile"];

/**
 * Topo da sidebar: a organização ativa e a troca entre as da pessoa. Numa
 * tela da organização, a troca mantém a tela e muda o conteúdo.
 */
export function OrganizationSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const organizations = useMyOrganizations();
  const current = useCurrentOrganization();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent" />}
      >
        <LogoMark className="size-8" />
        <span className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">{current?.name ?? "AccessFlow"}</span>
          <span className="truncate text-xs text-muted-foreground">
            {current ? current.viewerRole.name : "Escolha uma organização"}
          </span>
        </span>
        <ChevronsUpDownIcon className="ml-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organizações</DropdownMenuLabel>
          {organizations.length === 0 && (
            <DropdownMenuItem disabled>Nenhuma organização ainda</DropdownMenuItem>
          )}
          {organizations.map((organization) => (
            <DropdownMenuItem
              key={organization.id}
              onClick={() => {
                setActiveOrganization(organization.id);
                if (ACCOUNT_PATHS.includes(pathname)) router.push("/overview");
              }}
            >
              <span className="flex-1 truncate">{organization.name}</span>
              {organization.id === current?.id && <CheckIcon aria-label="Atual" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/organizations" />}>
            <LayoutGridIcon />
            Todas as organizações
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
