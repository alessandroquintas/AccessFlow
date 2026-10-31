import { cn } from "@/shared/lib/utils";

/** Marca: um buraco de fechadura em latão sobre a tinta petróleo. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
      <rect width="24" height="24" rx="6" fill="var(--primary)" />
      <circle cx="12" cy="9.75" r="3.25" fill="var(--key)" />
      <path d="M10.4 11.6h3.2l1.1 6.4h-5.4z" fill="var(--key)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading text-base font-semibold tracking-tight", className)}>
      <LogoMark />
      AccessFlow
    </span>
  );
}
