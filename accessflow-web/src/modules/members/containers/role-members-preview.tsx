"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useScenario } from "@/infra/mocks/scenario";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { initials } from "@/shared/lib/initials";
import { pluralize } from "@/shared/lib/format";
import { useMembers } from "../hooks/use-members";

/** Quantos membros a prévia mostra antes do link para a lista filtrada. */
const PREVIEW = 5;

interface RoleMembersPreviewProps {
  organizationId: string;
  roleId: string;
  roleName: string;
  /** Sem members:read, só a contagem (vem do papel), sem nomes nem link. */
  canSeeMembers: boolean;
  memberCount: number;
}

/** Os primeiros membros com o papel, ao lado do editor. */
export function RoleMembersPreview({ organizationId, roleId, roleName, canSeeMembers, memberCount }: RoleMembersPreviewProps) {
  const { members } = useMembers(organizationId);
  const scenario = useScenario();
  const withRole = members.filter((member) => member.role.id === roleId);
  const count = canSeeMembers ? withRole.length : memberCount;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>Membros com este papel</h2>
        </CardTitle>
        <CardDescription>{scenario === "empty" ? "Ninguém tem este papel ainda." : pluralize(count, "membro", "membros")}</CardDescription>
      </CardHeader>
      {canSeeMembers && scenario !== "empty" && withRole.length > 0 && (
        <>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {withRole.slice(0, PREVIEW).map((member) => (
                <li key={member.userId} className="flex min-w-0 items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{member.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Link
              href={`/members?role=${roleId}`}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {withRole.length > PREVIEW ? `Ver os ${withRole.length} membros` : "Ver na lista de membros"}
              <span className="sr-only"> com o papel {roleName}</span>
              <ArrowRightIcon aria-hidden="true" className="size-3" />
            </Link>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
