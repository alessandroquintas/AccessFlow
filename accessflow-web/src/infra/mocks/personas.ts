import { createStore } from "./create-store";

/**
 * Personas de design: quem está "logado" nas telas. Cada módulo decide, nas
 * próprias fixtures, o que cada persona vê.
 */
export type PersonaId = "owner" | "member" | "custom" | "first-access";

export interface Persona {
  id: PersonaId;
  label: string;
  description: string;
}

export const PERSONAS: readonly Persona[] = [
  { id: "owner", label: "OWNER", description: "Helena Duarte: OWNER em duas organizações" },
  { id: "member", label: "MEMBER", description: "Rafael Moreira: só members:read" },
  { id: "custom", label: "Gestor de acesso", description: "Camila Teixeira: papel personalizado" },
  { id: "first-access", label: "Primeiro acesso", description: "Joana Prado: sem perfil e sem organização" },
];

/**
 * Sessão de mentira. Fase 11b: a sessão real vem do Cognito (Hosted UI);
 * `signedIn` e `onboardedName` deixam de existir aqui.
 */
export interface MockSession {
  personaId: PersonaId;
  signedIn: boolean;
  /** Nome informado no onboarding pela persona de primeiro acesso. */
  onboardedName: string | null;
  /** Organização escolhida no seletor (null: a primeira da persona). */
  activeOrganizationId: string | null;
}

export const sessionStore = createStore<MockSession>(
  { personaId: "owner", signedIn: false, onboardedName: null, activeOrganizationId: null },
  "accessflow:mock-session",
);

export const getPersona = (id: PersonaId = sessionStore.get().personaId) =>
  PERSONAS.find((persona) => persona.id === id) ?? PERSONAS[0];

/** Trocar de persona recomeça o primeiro acesso e a escolha de organização. */
export const setPersona = (personaId: PersonaId) =>
  sessionStore.set((session) => ({
    ...session,
    personaId,
    onboardedName: null,
    activeOrganizationId: null,
  }));

/** Fase 11b: guardar num cookie, para o servidor saber a organização ativa. */
export const setActiveOrganization = (activeOrganizationId: string) =>
  sessionStore.set((session) => ({ ...session, activeOrganizationId }));

export const signIn = () => sessionStore.set((session) => ({ ...session, signedIn: true }));

export const signOut = () => sessionStore.set((session) => ({ ...session, signedIn: false }));

export const completeOnboarding = (name: string) =>
  sessionStore.set((session) => ({ ...session, onboardedName: name }));

/** Sem perfil local (equivale ao USER_NOT_FOUND): só o primeiro acesso antes do onboarding. */
export const hasProfile = ({ personaId, onboardedName }: MockSession) =>
  personaId !== "first-access" || onboardedName !== null;
