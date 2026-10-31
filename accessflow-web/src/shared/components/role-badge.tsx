import { Badge } from "@/shared/components/ui/badge";

export type RoleKind = "OWNER" | "MEMBER" | "CUSTOM";

/** OWNER em latão (é um poder); MEMBER neutro; papel personalizado com contorno. */
export function RoleBadge({ name, kind }: { name: string; kind: RoleKind }) {
  if (kind === "OWNER") return <Badge variant="key">OWNER</Badge>;
  if (kind === "MEMBER") return <Badge variant="secondary">MEMBER</Badge>;
  return <Badge variant="outline">{name}</Badge>;
}
