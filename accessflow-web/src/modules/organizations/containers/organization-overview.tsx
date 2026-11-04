"use client";

import { CableIcon, MailPlusIcon, PlusIcon, ScrollTextIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { setScenario, useScenario } from "@/infra/mocks/scenario";
import { PermissionCheck } from "@/modules/access-control/containers/permission-check";
import { RequirePermission } from "@/modules/access-control/containers/require-permission";
import { InviteMemberDialog } from "@/modules/invitations/containers/invite-member-dialog";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { LoadingRegion } from "@/shared/components/feedback/loading-region";
import { CardGridSkeleton, ListSkeleton } from "@/shared/components/feedback/skeletons";
import { PageBody, PageHeader } from "@/shared/components/layout/page-header";
import { RoleBadge } from "@/shared/components/role-badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { RecentActivityList } from "../components/recent-activity-list";
import { SUMMARY_GRID, type SummaryCardItem, SummaryCards } from "../components/summary-cards";
import { EMPTY_SUMMARY, ORGANIZATION_SUMMARIES, RECENT_ACTIVITY } from "../fixtures/overview";
import type { Organization } from "../schemas";

/** Quantas ações da trilha a visão geral mostra. */
const ACTIVITY_LIMIT = 6;

export function OrganizationOverview({ organization }: { organization: Organization }) {
  const pathname = usePathname();
  const scenario = useScenario();
  const empty = scenario === "empty";
  const summary = empty ? EMPTY_SUMMARY : ORGANIZATION_SUMMARIES[organization.id] ?? EMPTY_SUMMARY;
  const activity = empty ? [] : (RECENT_ACTIVITY[organization.id] ?? []).slice(0, ACTIVITY_LIMIT);
  const viewerIsOwner = organization.viewerRole.kind === "OWNER";

  return (
    <PermissionCheck organizationId={organization.id}>
      {(can) => {
        // Cada cartão leva a uma tela e só aparece para quem pode vê-la.
        const cards: SummaryCardItem[] = [
          can("members:read") && {
            label: "Membros ativos",
            value: empty ? 1 : organization.memberCount,
            href: "/members",
            linkLabel: "Ver membros",
            icon: UsersIcon,
          },
          can("members:invite") && {
            label: "Convites pendentes",
            value: summary.pendingInvitations,
            href: "/members/invitations",
            linkLabel: "Ver convites",
            icon: MailPlusIcon,
          },
          can("roles:read") && {
            label: "Papéis",
            value: summary.roles,
            href: "/roles",
            linkLabel: "Ver papéis",
            icon: ShieldCheckIcon,
          },
          can("integrations:read") && {
            label: "Integrações ativas",
            value: summary.activeIntegrations,
            href: "/integrations",
            linkLabel: "Ver integrações",
            icon: CableIcon,
          },
        ].filter((card) => card !== false);

        const quickActions = can("members:invite") || can("roles:manage") || can("integrations:manage");

        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: organization.name }]}
              title={organization.name}
              description={can("audit:read") ? "O resumo da organização e o que mudou por último." : "O resumo da organização."}
              meta={<RoleBadge {...organization.viewerRole} />}
              loading={scenario === "loading"}
            />
            <PageBody>
              <RequirePermission organizationId={organization.id} permissions={[]}>
                {scenario === "loading" ? (
                  <LoadingRegion label="Carregando visão geral…" className="flex flex-col gap-6">
                    <CardGridSkeleton variant="summary" count={cards.length} className={SUMMARY_GRID} />
                    {(can("audit:read") || quickActions) && (
                      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-3">
                        {can("audit:read") && (
                          <Card className="lg:col-span-2">
                            <CardHeader>
                              <Skeleton className="h-4 w-36" />
                            </CardHeader>
                            <CardContent>
                              <ListSkeleton rows={ACTIVITY_LIMIT} />
                            </CardContent>
                          </Card>
                        )}
                        {quickActions && (
                          <Card className="self-start">
                            <CardHeader>
                              <Skeleton className="h-4 w-28" />
                              <Skeleton className="h-3.5 w-48" />
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                              <Skeleton className="h-8 w-full rounded-lg" />
                              <Skeleton className="h-8 w-full rounded-lg" />
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </LoadingRegion>
                ) : scenario === "error" ? (
                  <ErrorState onRetry={() => setScenario("normal", pathname)} />
                ) : (
                  <>
                    {cards.length > 0 && <SummaryCards items={cards} />}

                    {(can("audit:read") || quickActions) && (
                      <div className="grid gap-6 lg:grid-cols-3">
                        {can("audit:read") && (
                          <Card className="lg:col-span-2">
                            <CardHeader>
                              <CardTitle>
                                <h2>Atividade recente</h2>
                              </CardTitle>
                              <CardAction>
                                <Button variant="link" size="sm" render={<Link href="/audit" />} nativeButton={false}>
                                  <ScrollTextIcon data-icon="inline-start" />
                                  Ver auditoria
                                </Button>
                              </CardAction>
                            </CardHeader>
                            <CardContent>
                              {activity.length > 0 ? (
                                <RecentActivityList entries={activity} />
                              ) : (
                                <Empty className="p-6">
                                  <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                      <ScrollTextIcon />
                                    </EmptyMedia>
                                    <EmptyTitle>Nada registrado ainda</EmptyTitle>
                                    <EmptyDescription>
                                      Convites, trocas de papel e integrações aparecem aqui assim que acontecerem.
                                    </EmptyDescription>
                                  </EmptyHeader>
                                </Empty>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {quickActions && (
                          <Card className="self-start">
                            <CardHeader>
                              <CardTitle>
                                <h2>Ações rápidas</h2>
                              </CardTitle>
                              <CardDescription>O que você pode fazer com o seu papel.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 *:w-full *:justify-start">
                              {can("members:invite") && (
                                <InviteMemberDialog
                                  organizationId={organization.id}
                                  viewerIsOwner={viewerIsOwner}
                                  variant="outline"
                                />
                              )}
                              {/* Leva à tela de integrações com o diálogo de criar aberto. */}
                              {can("roles:manage") && (
                                <Button variant="outline" render={<Link href="/roles/new" />} nativeButton={false}>
                                  <PlusIcon data-icon="inline-start" />
                                  Criar papel
                                </Button>
                              )}
                              {can("integrations:manage") && (
                                <Button variant="outline" render={<Link href="/integrations?create=1" />} nativeButton={false}>
                                  <PlusIcon data-icon="inline-start" />
                                  Criar integração
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </>
                )}
              </RequirePermission>
            </PageBody>
          </>
        );
      }}
    </PermissionCheck>
  );
}
