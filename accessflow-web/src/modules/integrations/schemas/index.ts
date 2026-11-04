import { z } from "zod";

/** Escopos de máquina do accessflow-api, na ordem do catálogo. */
export const INTEGRATION_SCOPES = ["accessflow-api/members.read", "accessflow-api/authorize"] as const;

export const integrationScopeSchema = z.enum(INTEGRATION_SCOPES);

/** PROVISIONING: em criação. ACTIVE: a única que autoriza. FAILED: o app client não chegou a existir. */
export const integrationStatusSchema = z.enum(["PROVISIONING", "ACTIVE", "FAILED", "REVOKED"]);

/** Integração da organização (equivale ao `IntegrationClient`). */
export const integrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Nulo em PROVISIONING e FAILED. */
  clientId: z.string().nullable(),
  scopes: z.array(integrationScopeSchema),
  status: integrationStatusSchema,
  /** Nulo nas integrações anteriores ao painel. */
  createdBy: z.object({ userId: z.string(), name: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
});

/** Limite da API: até 5 em criação ou ativas por organização. */
export const MAX_LIVE_INTEGRATIONS = 5;

export const createIntegrationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe pelo menos 2 caracteres.")
    .max(60, "Use no máximo 60 caracteres."),
  scopes: z.array(integrationScopeSchema).min(1, "Escolha pelo menos um escopo."),
});

export type IntegrationScope = z.infer<typeof integrationScopeSchema>;
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;
export type Integration = z.infer<typeof integrationSchema>;
export type CreateIntegrationForm = z.infer<typeof createIntegrationFormSchema>;

/**
 * O que a criação devolve (equivale ao `CreatedIntegrationClient`). Só vive
 * no estado do diálogo do segredo: nunca em fixture, store, URL ou log.
 */
export interface CreatedIntegration {
  integration: Integration;
  clientSecret: string;
}
