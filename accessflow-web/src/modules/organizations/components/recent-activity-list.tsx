import { CableIcon, KeyRoundIcon, type LucideIcon, MailPlusIcon, SettingsIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { LocalDate } from "@/shared/components/local-date";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import type { ActivityEntry } from "../schemas";

/** Um ícone por conceito, o mesmo do menu (docs/design-direction.md). */
const ICONS: Record<ActivityEntry["kind"], LucideIcon> = {
  member: UsersIcon,
  invitation: MailPlusIcon,
  role: ShieldCheckIcon,
  permission: KeyRoundIcon,
  integration: CableIcon,
  organization: SettingsIcon,
};

/** Mesmo formato do ListSkeleton: ícone, duas linhas e o tempo à direita. */
export function RecentActivityList({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ol className="flex flex-col divide-y">
      {entries.map((entry) => {
        const Icon = ICONS[entry.kind];
        return (
          <li key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <p className="break-words">
                <span className="font-medium">{entry.actorName}</span>{" "}
                <span className="text-muted-foreground">{entry.summary}</span>
                {entry.permission && (
                  <>
                    {" "}
                    <PermissionKeyTag value={entry.permission} />
                  </>
                )}
              </p>
            </div>
            <LocalDate
              iso={entry.occurredAt}
              format="relative"
              className="shrink-0 text-xs leading-5 text-muted-foreground"
            />
          </li>
        );
      })}
    </ol>
  );
}
