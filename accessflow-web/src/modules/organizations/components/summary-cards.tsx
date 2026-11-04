import { ArrowRightIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { formatNumber } from "@/shared/lib/format";

export interface SummaryCardItem {
  label: string;
  value: number;
  href: string;
  /** O texto do link, que diz para onde ele leva. */
  linkLabel: string;
  icon: LucideIcon;
}

/** Os mesmos cartões e a mesma grade do CardGridSkeleton "summary". */
export const SUMMARY_GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

export function SummaryCards({ items }: { items: SummaryCardItem[] }) {
  return (
    <ul className={SUMMARY_GRID}>
      {items.map(({ label, value, href, linkLabel, icon: Icon }) => (
        <li key={href}>
          <Card
            size="sm"
            className="relative h-full transition-colors has-[a:hover]:bg-accent/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <span className="font-heading text-2xl font-semibold tabular-nums">{formatNumber(value)}</span>
              <Link
                href={href}
                className="flex items-center gap-1 text-xs font-medium text-primary outline-none after:absolute after:inset-0"
              >
                {linkLabel}
                <ArrowRightIcon aria-hidden="true" className="size-3" />
              </Link>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
