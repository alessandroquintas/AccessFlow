import Link from "next/link";
import { Fragment } from "react";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import { Separator } from "@/shared/components/ui/separator";
import { SidebarTrigger } from "@/shared/components/ui/sidebar";

export interface BreadcrumbEntry {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs: BreadcrumbEntry[];
  title: string;
  description?: React.ReactNode;
  /** Ações da página, à direita da barra superior. */
  actions?: React.ReactNode;
}

/** Barra superior (menu, trilha, ações, tema) e o título da página. */
export function PageHeader({ breadcrumbs, title, description, actions }: PageHeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map((entry, index) => {
              const last = index === breadcrumbs.length - 1;
              return (
                <Fragment key={`${entry.label}-${index}`}>
                  {/* Em telas estreitas fica só o último nível. */}
                  <BreadcrumbItem className={last ? "min-w-0" : "hidden md:inline-flex"}>
                    {last || !entry.href ? (
                      <BreadcrumbPage className="truncate">{entry.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={entry.href} />}>{entry.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!last && <BreadcrumbSeparator className="hidden md:block" />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-col gap-1 px-4 pt-6 sm:px-6">
        <h1 className="font-heading text-2xl font-semibold text-balance">{title}</h1>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
    </>
  );
}

/** Corpo da página, com o mesmo respiro lateral do cabeçalho. */
export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-6 px-4 py-6 sm:px-6">{children}</div>;
}
