import { LogOutIcon, MoreHorizontalIcon, ShieldCheckIcon, UserMinusIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { Member } from "../schemas";

/**
 * O que o viewer pode fazer na linha. Ausente: a ação não aparece.
 * `blocked`: aparece desabilitada, com o motivo.
 */
export interface MemberRowActions {
  changeRole?: { blocked?: string };
  remove?: true;
  leave?: { blocked?: string };
}

export interface MemberActionHandlers {
  onChangeRole: (member: Member) => void;
  onRemove: (member: Member) => void;
  onLeave: (member: Member) => void;
}

export const hasActions = ({ changeRole, remove, leave }: MemberRowActions) =>
  Boolean(changeRole || remove || leave);

/** Item desabilitado com o motivo logo abaixo. */
function BlockedReason({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

export function MemberActionsMenu({
  member,
  actions,
  isViewer,
  onChangeRole,
  onRemove,
  onLeave,
}: { member: Member; actions: MemberRowActions; isViewer: boolean } & MemberActionHandlers) {
  if (!hasActions(actions)) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={isViewer ? "Suas ações nesta organização" : `Mais ações para ${member.name}`}
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {actions.changeRole && (
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={Boolean(actions.changeRole.blocked)}
              onClick={() => onChangeRole(member)}
              className="items-start data-disabled:text-muted-foreground data-disabled:opacity-100"
            >
              <ShieldCheckIcon />
              <span className="flex flex-col gap-0.5">
                Trocar papel
                {actions.changeRole.blocked && <BlockedReason>{actions.changeRole.blocked}</BlockedReason>}
              </span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
        {actions.changeRole && (actions.remove || actions.leave) && <DropdownMenuSeparator />}
        {(actions.remove || actions.leave) && (
          <DropdownMenuGroup>
            {actions.remove && (
              <DropdownMenuItem variant="destructive" onClick={() => onRemove(member)}>
                <UserMinusIcon />
                Remover da organização
              </DropdownMenuItem>
            )}
            {actions.leave && (
              <DropdownMenuItem
                // Bloqueado não tem o vermelho de ação destrutiva: não há o que confirmar.
                variant={actions.leave.blocked ? "default" : "destructive"}
                disabled={Boolean(actions.leave.blocked)}
                onClick={() => onLeave(member)}
                className="items-start data-disabled:text-muted-foreground data-disabled:opacity-100"
              >
                <LogOutIcon />
                <span className="flex flex-col gap-0.5">
                  Sair da organização
                  {actions.leave.blocked && <BlockedReason>{actions.leave.blocked}</BlockedReason>}
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
