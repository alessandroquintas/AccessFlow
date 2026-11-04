import type { Integration } from "../schemas";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const HELENA = { userId: "u-helena", name: "Helena Duarte" };
const GUSTAVO = { userId: "u-gustavo", name: "Gustavo Amaral" };

/** Integrações de cada organização (por id), da mais nova à mais antiga (como o `integrationClients`). */
export const INTEGRATIONS: Record<string, Integration[]> = {
  "org-vale-verde": [
    {
      id: "int-bi",
      name: "BI Relatórios",
      clientId: null,
      scopes: ["accessflow-api/authorize"],
      status: "PROVISIONING",
      createdBy: GUSTAVO,
      createdAt: daysAgo(0.01),
      revokedAt: null,
    },
    {
      id: "int-importador",
      name: "Importador legado",
      clientId: null,
      scopes: ["accessflow-api/members.read"],
      status: "FAILED",
      createdBy: GUSTAVO,
      createdAt: daysAgo(3),
      revokedAt: null,
    },
    {
      id: "int-erp",
      name: "ERP Financeiro",
      clientId: "4f1c9a2e7b8d3c6a5e0f1b2d9c",
      scopes: ["accessflow-api/members.read", "accessflow-api/authorize"],
      status: "ACTIVE",
      createdBy: HELENA,
      createdAt: daysAgo(5),
      revokedAt: null,
    },
    {
      id: "int-portal",
      name: "Portal do Cooperado",
      clientId: "7k2m9p4q1r8s5t3v6w0x2y4z8a",
      scopes: ["accessflow-api/members.read"],
      status: "ACTIVE",
      createdBy: HELENA,
      createdAt: daysAgo(41),
      revokedAt: null,
    },
    {
      id: "int-campo",
      name: "App de campo (antigo)",
      clientId: "1b3d5f7h9j2l4n6p8r0t2v4x6z",
      scopes: ["accessflow-api/authorize"],
      status: "REVOKED",
      createdBy: null,
      createdAt: daysAgo(120),
      revokedAt: daysAgo(30),
    },
  ],
  "org-atlantico": [
    {
      id: "int-lims",
      name: "LIMS Amostras",
      clientId: "9c8b7a6d5e4f3g2h1j0k9l8m7n",
      scopes: ["accessflow-api/members.read", "accessflow-api/authorize"],
      status: "ACTIVE",
      createdBy: HELENA,
      createdAt: daysAgo(9),
      revokedAt: null,
    },
  ],
};

/**
 * Limite reduzido no Laboratório Atlântico, só para revisar o estado de
 * "limite atingido" (o da API é 5). Fase 11b: some.
 */
export const DESIGN_LIMITS: Record<string, number> = { "org-atlantico": 1 };

/**
 * Endpoint de token do Cognito no exemplo de client credentials. Fase 11b:
 * vem da configuração (saída `token_endpoint` do Terraform em infra/permanent).
 */
export const TOKEN_ENDPOINT = "https://accessflow-exemplo.auth.us-east-1.amazoncognito.com/oauth2/token";
