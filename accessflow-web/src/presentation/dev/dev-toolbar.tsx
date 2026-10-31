"use client";

import { UserCogIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  getPersona,
  PERSONAS,
  type PersonaId,
  sessionStore,
  setPersona,
} from "@/infra/mocks/personas";
import { type ScenarioMode, setScenario, useScenario } from "@/infra/mocks/scenario";
import { useStore } from "@/infra/mocks/use-store";
import { Button } from "@/shared/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/shared/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Separator } from "@/shared/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group";

const SCENARIOS: { value: ScenarioMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "loading", label: "Carregando" },
  { value: "empty", label: "Vazio" },
  { value: "error", label: "Erro" },
];

/**
 * Ferramenta de design (só fora de produção): troca a persona e força um
 * estado (carregando, vazio, erro) na tela atual.
 */
interface DevToolbarProps {
  /**
   * floating: botão fixo no canto inferior esquerdo (telas públicas e /design;
   * o direito é do indicador do Next). inline: no rodapé da sidebar.
   */
  variant?: "floating" | "inline";
}

export function DevToolbar({ variant = "floating" }: DevToolbarProps) {
  const pathname = usePathname();
  const { personaId } = useStore(sessionStore);
  const currentScenario = useScenario();
  const persona = getPersona(personaId);

  return (
    <Popover>
      <PopoverTrigger
        render={
          variant === "floating" ? (
            <Button
              variant="outline"
              size="sm"
              className="fixed bottom-4 left-4 z-40 shadow-sm print:hidden"
            />
          ) : (
            <Button variant="ghost" size="sm" className="w-full justify-start" />
          )
        }
      >
        <UserCogIcon data-icon="inline-start" />
        Persona: {persona.label}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Ambiente de desenvolvimento</PopoverTitle>
          <PopoverDescription>
            Dados fictícios. Este controle não existe em produção.
          </PopoverDescription>
        </PopoverHeader>

        <FieldSet>
          <FieldLegend variant="label">Persona</FieldLegend>
          <RadioGroup
            value={personaId}
            onValueChange={(value) => setPersona(value as PersonaId)}
          >
            {PERSONAS.map((option) => (
              <Field key={option.id} orientation="horizontal">
                <RadioGroupItem value={option.id} id={`persona-${option.id}`} />
                <FieldContent>
                  <FieldLabel htmlFor={`persona-${option.id}`}>{option.label}</FieldLabel>
                  <FieldDescription>{option.description}</FieldDescription>
                </FieldContent>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>

        <Separator />

        <FieldSet>
          <FieldLegend variant="label" id="scenario-label">
            Cenário desta tela
          </FieldLegend>
          <ToggleGroup
            aria-labelledby="scenario-label"
            variant="outline"
            size="sm"
            spacing={0}
            value={[currentScenario]}
            onValueChange={(value) =>
              setScenario((value[0] as ScenarioMode | undefined) ?? "normal", pathname)
            }
          >
            {SCENARIOS.map(({ value, label }) => (
              <ToggleGroupItem key={value} value={value}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>Vale só para {pathname}.</FieldDescription>
        </FieldSet>

      </PopoverContent>
    </Popover>
  );
}
