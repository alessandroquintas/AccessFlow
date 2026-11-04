"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";

interface CopyButtonProps {
  /** O que vai para a área de transferência (pode estar mascarado na tela). */
  value: string;
  /** O que é copiado, para o rótulo e o toast: "client_id", "requestId". */
  label: string;
  size?: "icon-xs" | "icon-sm";
  variant?: "ghost" | "outline";
}

/** Copia sem mostrar o valor no toast: o aviso diz só o que foi copiado. */
export function CopyButton({ value, label, size = "icon-sm", variant = "ghost" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={`Copiar ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copiado`);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error(`Não foi possível copiar o ${label}`, {
            description: "O navegador bloqueou a área de transferência. Selecione o texto e copie manualmente.",
          });
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
