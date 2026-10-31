import { ArrowUpRightIcon, Building2Icon } from "lucide-react";
import Link from "next/link";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { LocalDate } from "@/shared/components/local-date";
import { pluralize } from "@/shared/lib/format";
import type { Organization } from "../schemas";
import { RoleBadge } from "@/shared/components/role-badge";

interface OrganizationCardListProps {
  organizations: Organization[];
  /** Abrir uma organização a torna a ativa. */
  onOpen: (organization: Organization) => void;
}

export function OrganizationCardList({ organizations, onOpen }: OrganizationCardListProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {organizations.map((organization) => (
        <li key={organization.id}>
          <Card className="relative h-full transition-colors has-[a:hover]:bg-accent/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
            <CardHeader>
              <CardTitle className="flex min-w-0 items-center gap-2">
                <Building2Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <Link
                  href="/overview"
                  onClick={() => onOpen(organization)}
                  className="truncate outline-none after:absolute after:inset-0"
                >
                  {organization.name}
                </Link>
              </CardTitle>
              <CardDescription>
                <code className="font-mono text-xs">{organization.slug}</code>
              </CardDescription>
              <CardAction>
                <RoleBadge {...organization.viewerRole} />
              </CardAction>
            </CardHeader>
            <CardFooter className="justify-between gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{pluralize(organization.memberCount, "membro", "membros")}</span>
              <span className="flex items-center gap-1">
                Desde <LocalDate iso={organization.createdAt} />
                <ArrowUpRightIcon aria-hidden="true" className="size-4" />
              </span>
            </CardFooter>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function OrganizationCardListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando organizações">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}
