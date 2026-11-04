/*
 * Alterado em relação ao gerado pelo shadcn (Fase 11a, Parte 3): o
 * `animate-pulse` virou o brilho da esquerda para a direita
 * (`motion-safe:skeleton-shimmer motion-safe:animate-shimmer`, definidos no
 * globals.css), parado com prefers-reduced-motion. Rodar
 * `npx shadcn add skeleton` sobrescreve esta mudança.
 */
import { cn } from "cn"

/**
 * Bloco estático em `muted`; com movimento permitido, o brilho atravessa da
 * esquerda para a direita (`skeleton-shimmer` e `animate-shimmer` no
 * globals.css). Com `prefers-reduced-motion: reduce`, fica só o bloco.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-muted motion-safe:skeleton-shimmer motion-safe:animate-shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
