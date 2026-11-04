import { LockIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { PermissionKeyTag } from "@/shared/components/permission-key-tag";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/components/ui/empty";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/shared/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/components/ui/input-group";
import { groupByResource, type PermissionLock, toggleGroup } from "../lib/role-editor";
import type { PermissionDefinition, PermissionKey } from "../schemas";

const RESOURCE_LABELS: Record<string, string> = {
  organizations: "Organização",
  members: "Membros",
  roles: "Papéis",
  permissions: "Permissões",
  integrations: "Integrações",
  audit: "Auditoria",
};

/** Mesma linguagem da /design: diz por que a caixa está travada. */
const ESCALATION_TEXT = "Você não tem esta permissão, então não pode concedê-la nem retirá-la.";

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

interface PermissionChecklistProps {
  catalog: PermissionDefinition[];
  selected: PermissionKey[];
  lockOf: (key: PermissionKey) => PermissionLock;
  onChange: (next: PermissionKey[]) => void;
}

/** Permissões agrupadas por recurso, com busca e "Selecionar todas" respeitando as travadas. */
export function PermissionChecklist({ catalog, selected, lockOf, onChange }: PermissionChecklistProps) {
  const [query, setQuery] = useState("");
  const needle = fold(query);
  const isLocked = (key: PermissionKey) => lockOf(key) !== null;
  const groups = groupByResource(
    needle === ""
      ? catalog
      : catalog.filter(({ key, description }) => fold(key).includes(needle) || fold(description).includes(needle)),
  );

  return (
    <div className="flex flex-col gap-6">
      <InputGroup className="sm:max-w-sm">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label="Buscar permissão por chave ou descrição"
          placeholder="Buscar por chave ou descrição"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </InputGroup>

      {groups.length === 0 && (
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyTitle>Nenhuma permissão encontrada</EmptyTitle>
            <EmptyDescription>Nenhuma chave ou descrição tem “{query}”.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {groups.map((group) => {
        const keys = group.permissions.map(({ key }) => key);
        const free = keys.filter((key) => !isLocked(key));
        const allFreeOn = free.length > 0 && free.every((key) => selected.includes(key));
        const count = keys.filter((key) => selected.includes(key)).length;

        return (
          <FieldSet key={group.resource} className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLegend variant="label" className="mb-0 flex items-center gap-2">
                {RESOURCE_LABELS[group.resource] ?? <code className="font-mono">{group.resource}</code>}
                {group.system && <code className="font-mono text-xs font-normal text-muted-foreground">{group.resource}</code>}
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {count} de {keys.length}
                </span>
              </FieldLegend>
              {free.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onChange(toggleGroup(selected, keys, isLocked, !allFreeOn))}
                  aria-label={`${allFreeOn ? "Desmarcar" : "Selecionar"} todas de ${RESOURCE_LABELS[group.resource] ?? group.resource}`}
                >
                  {allFreeOn ? "Desmarcar todas" : "Selecionar todas"}
                </Button>
              )}
            </div>
            {group.permissions.map(({ key, description }) => {
              const lock = lockOf(key);
              const id = `permission-${key}`;
              return (
                <Field key={key} orientation="horizontal" data-disabled={lock !== null || undefined}>
                  <Checkbox
                    id={id}
                    checked={selected.includes(key)}
                    disabled={lock !== null}
                    onCheckedChange={(checked) =>
                      onChange(checked ? [...selected, key] : selected.filter((item) => item !== key))
                    }
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={id}>
                      <PermissionKeyTag value={key} />
                      {lock === "escalation" && <LockIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />}
                    </FieldLabel>
                    <FieldDescription>
                      {description}
                      {lock === "escalation" && (
                        <>
                          <br />
                          {ESCALATION_TEXT}
                        </>
                      )}
                    </FieldDescription>
                  </FieldContent>
                </Field>
              );
            })}
          </FieldSet>
        );
      })}
    </div>
  );
}
