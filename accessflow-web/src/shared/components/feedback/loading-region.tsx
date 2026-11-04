interface LoadingRegionProps {
  /** Lido pelos leitores de tela, ex.: "Carregando membros…". */
  label: string;
  className?: string;
  /** Os skeletons (cada um já marcado com aria-hidden). */
  children: React.ReactNode;
}

/**
 * Contêiner em carregamento: aria-busy e um texto só para leitores de tela.
 *
 * Fase 11b: é aqui que entra o atraso mínimo antes de exibir o skeleton
 * (algo como 200–300 ms), para respostas rápidas não piscarem. Enquanto ele
 * não vence, o contêiner fica vazio com a mesma altura.
 */
export function LoadingRegion({ label, className, children }: LoadingRegionProps) {
  return (
    <div aria-busy="true" className={className}>
      <span role="status" className="sr-only">
        {label}
      </span>
      {children}
    </div>
  );
}
