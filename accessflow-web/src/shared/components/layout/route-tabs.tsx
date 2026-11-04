import Link from "next/link";
import { cn } from "@/shared/lib/utils";

export interface RouteTab {
  value: string;
  label: string;
  href: string;
}

/**
 * Abas de navegação: cada uma é uma rota (dá para abrir e compartilhar o
 * endereço), então são links com aria-current, não o componente Tabs.
 * Quem chama decide quais abas o viewer vê.
 */
export function RouteTabs({ label, tabs, current }: { label: string; tabs: RouteTab[]; current: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="-mb-px flex gap-4">
        {tabs.map((tab) => (
          <li key={tab.value} className="shrink-0">
            <Link
              href={tab.href}
              aria-current={tab.value === current ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center border-b-2 border-transparent px-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring",
                tab.value === current && "border-primary text-foreground",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
