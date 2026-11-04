"use client";

import { ChevronDownIcon, InfoIcon } from "lucide-react";
import { CopyButton } from "@/shared/components/copy-button";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { ScopeTag } from "@/shared/components/scope-tag";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import type { DetailItem, Segment } from "../lib/describe";
import { type Period, PERIODS } from "../lib/period";

/** O texto da ação, com nomes em destaque e chaves como tag. */
export function SegmentText({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        typeof segment === "string" ? (
          <span key={index} className="text-muted-foreground">
            {segment}
          </span>
        ) : "strong" in segment ? (
          <span key={index} className="font-medium text-foreground">
            {segment.strong}
          </span>
        ) : (
          <PermissionKeyTag key={index} value={segment.permission} className="align-baseline" />
        ),
      )}
    </>
  );
}

/** Os detalhes de um registro como lista de termos: "de → para", tags, escopos. */
export function DetailList({ items, requestId }: { items: DetailItem[]; requestId: string | null }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0">
            {item.kind === "change" ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground line-through">{item.from}</span>
                <span aria-label="para">→</span>
                <span className="font-medium">{item.to}</span>
              </span>
            ) : item.kind === "permissions" ? (
              <ul className="flex flex-wrap gap-1.5">
                {item.keys.length === 0 && <li className="text-muted-foreground">Nenhuma</li>}
                {item.keys.map((key) => (
                  <li key={key} className="flex items-center gap-1">
                    {item.sign && (
                      <span aria-hidden="true" className={item.sign === "+" ? "text-success" : "text-destructive"}>
                        {item.sign}
                      </span>
                    )}
                    <PermissionKeyTag value={key} />
                  </li>
                ))}
              </ul>
            ) : item.kind === "scopes" ? (
              <span className="flex flex-wrap gap-1.5">
                {item.scopes.map((scope) => (
                  <ScopeTag key={scope} value={scope} />
                ))}
              </span>
            ) : item.kind === "mono" ? (
              <code translate="no" className="font-mono text-xs break-all">{item.value}</code>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
      <div className="contents">
        <dt className="text-muted-foreground">requestId</dt>
        <dd>
          <RequestId value={requestId} />
        </dd>
      </div>
    </dl>
  );
}

/** O requestId (para achar os logs da requisição), com copiar; "—" quando não houve. */
export function RequestId({ value }: { value: string | null }) {
  if (!value) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sem requestId</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <code translate="no" className="font-mono text-xs">{value}</code>
      <CopyButton value={value} label="requestId" size="icon-xs" />
    </span>
  );
}

/** A nota de retenção da aba. */
export function RetentionNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function PeriodSelect({
  value,
  options,
  onChange,
}: {
  value: Period;
  options: Period[];
  onChange: (period: Period) => void;
}) {
  const items = options.map((period) => ({ value: period, label: PERIODS[period].label }));
  return (
    <Select items={items} value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger aria-label="Período" className="w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Um filtro de uma escolha, com "todos" como primeira opção. */
export function SingleSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
  className = "w-full sm:w-48",
}: {
  label: string;
  allLabel: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
  className?: string;
}) {
  const items = [{ value: null, label: allLabel }, ...options];
  return (
    <Select items={items} value={value} onValueChange={(next) => onChange(next)}>
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.label} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Um filtro de várias escolhas (ações, eventos), em grupos. */
export function MultiSelect<T extends string>({
  label,
  allLabel,
  value,
  groups,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: T[];
  groups: { label?: string; options: { value: T; label: string }[] }[];
  onChange: (value: T[]) => void;
}) {
  const options = groups.flatMap((group) => group.options);
  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? options.find((option) => option.value === value[0])?.label
        : `${value.length} selecionadas`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="w-full justify-between font-normal sm:w-52" aria-label={`${label}: ${summary}`} />}
      >
        <span className="truncate">{summary}</span>
        <ChevronDownIcon data-icon="inline-end" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60">
        {groups.map((group, index) => (
          <DropdownMenuGroup key={group.label ?? index}>
            {index > 0 && <DropdownMenuSeparator />}
            {group.label && <DropdownMenuLabel>{group.label}</DropdownMenuLabel>}
            {group.options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={value.includes(option.value)}
                closeOnClick={false}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...value, option.value] : value.filter((item) => item !== option.value))
                }
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        ))}
        {value.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onChange([])}>Limpar seleção</DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
