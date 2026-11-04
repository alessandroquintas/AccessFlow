# Pontos de integração da Fase 11b

Este documento lista o que a Fase 11a deixou de fachada e por qual operação da API cada ponto é substituído. As
operações têm o nome do `accessflow-api/src/graphql/schema.gql`. Os caminhos são relativos a `accessflow-web/src`.

## Como a fachada funciona hoje

Cada ponto de fachada é de um destes tipos:

- **Fixture** (`modules/<m>/fixtures/*.ts`): dados fictícios por persona ou organização, lidos pelos hooks do
  módulo. Na 11b, o hook passa a chamar a query, e a fixture sai.
- **Store de fachada** (`createStore` em `modules/<m>/hooks/*.ts`): guarda em memória o que uma ação mudou, para a
  tela refletir a mudança enquanto a página está aberta. Some na 11b: a mutation invalida o cache da query (React
  Query), e a lista volta da API.
- **`mockActionError(...codes)`** (`infra/mocks/scenario.ts`): devolve um código de erro de domínio quando a chave
  "Simular erro da API" do seletor está ligada. Na 11b, a chamada vira a mutation, e o código passa a vir do erro
  GraphQL (`extensions.code`).
- **Estados de tela** (`useScenario`): carregando, vazio, erro e sem permissão, forçados pelo seletor. Na 11b vêm de
  `isPending`, de uma lista vazia, de `isError` e de `myPermissions`. O seletor e `infra/mocks/` saem do build de
  produção.

O texto do erro já passa pelo mapa de mensagens em `shared/lib/api-errors.ts` (`apiErrorMessage(code)`), que fica
como está. Os códigos que ele ainda não cobre caem na mensagem genérica.

Para a camada de dados já existem `shared/lib/react-query/create-query.ts`, `create-mutation.ts` e
`infra/http/api-client.ts`. A troca é em cada `hooks/` de módulo; os containers continuam recebendo as mesmas
props.

## Pontos transversais

| O que | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Sessão | `sessionStore` no localStorage (`accessflow:mock-session`), com a persona, `signedIn` e `onboardedName` | Sessão real do Cognito (Hosted UI, PKCE) em cookie HttpOnly; checagem de preferência no `proxy.ts`, antes de renderizar | `infra/mocks/personas.ts`, `modules/auth/containers/require-session.tsx` |
| Entrar e sair | `signIn()` e `signOut()` mudam o store | `sign-in-button.tsx`: redireciona para `/oauth2/authorize`. `auth-callback.tsx`: troca o `code` pelos tokens. `sign-out-*`: limpa a sessão e passa pelo `/logout` | `modules/auth/containers/*` |
| Perfil do viewer | `PROFILES` por persona | `me`; `USER_NOT_FOUND` leva ao onboarding (`provisionMe`) | `modules/identity/hooks/use-viewer-profile.ts` |
| Organização ativa | `activeOrganizationId` no `sessionStore` | Cookie, para o servidor saber a organização antes de renderizar. Na troca, invalidar as queries da organização | `infra/mocks/personas.ts` (`setActiveOrganization`), `modules/organizations/hooks/use-my-organizations.ts` |
| Permissões do viewer | `VIEWER_PERMISSIONS` (OWNER = `"ALL"`) | `myPermissions(organizationId)` (o OWNER já recebe o catálogo inteiro) | `modules/access-control/hooks/use-permissions.ts` |
| Atraso mínimo do skeleton | Ainda não implementado | Esperar uns 200 a 300 ms antes de mostrar o skeleton, para respostas rápidas não piscarem | `shared/components/feedback/loading-region.tsx` |
| Erro inesperado | `console.error` | Enviar ao serviço de observabilidade com o `requestId` | `presentation/pages/errors/error-page.tsx` |
| Seletor de persona e cenário | `presentation/dev/dev-toolbar.tsx` e `infra/mocks/*` | Sai do build de produção (já só renderiza fora de produção) | idem |
| Erro simulado nas ações | `mockActionError` | Some; o erro vem da mutation | `infra/mocks/scenario.ts` |

## Por tela

### `/organizations` (minhas organizações)

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Lista | `MY_ORGANIZATIONS` por persona | `myOrganizations` (`viewerAssignedRole` no lugar de `viewerRole`, que está depreciado) | `modules/organizations/hooks/use-my-organizations.ts` |
| Contagem de membros no cartão | `memberCount` na fixture | A query `Organization` não tem `memberCount`. Alternativas: um campo novo na API ou tirar a contagem do cartão | `modules/organizations/components/organization-card-list.tsx` |
| Criar organização | Toast | `createOrganization`; torná-la a ativa e abrir `/overview`. Erro esperado: `SLUG_ALREADY_TAKEN` | `modules/organizations/containers/create-organization-dialog.tsx` |
| Nome trocado em Configurações | `renamedStore` | Some (invalidar `myOrganizations`) | `modules/organizations/hooks/use-my-organizations.ts` |

### `/invitations` (meus convites)

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Lista e contador da sidebar | `MY_INVITATIONS` com o filtro de `answeredStore` | `myInvitations` | `modules/invitations/hooks/use-my-invitations.ts` |
| Aceitar | `markAnswered` | `acceptInvitation`, depois invalidar `myOrganizations` e `myInvitations` | `modules/invitations/containers/my-invitations.tsx` |
| Recusar | `markAnswered` | `declineInvitation` | idem |

### `/profile` e `/onboarding`

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Salvar o nome | Toast | `updateMyProfile` | `modules/identity/containers/profile-settings.tsx` |
| Primeiro acesso | `completeOnboarding` | `provisionMe`; só seguir depois da resposta | `modules/identity/containers/onboarding.tsx` |

### `/overview`

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Cartões de resumo | `ORGANIZATION_SUMMARIES` (e `memberCount` da organização) | Não há query de resumo. Membros: `organizationMembers` (contar). Convites pendentes: `organizationInvitations` (só pendentes no prazo). Papéis: `organizationRoles` (contar). Integrações ativas: `integrationClients` (status `ACTIVE`). Cada cartão só pede a query se o viewer tem a permissão | `modules/organizations/containers/organization-overview.tsx` (importa a fixture direto: passar para um hook) |
| Atividade recente | `RECENT_ACTIVITY` | `auditEvents(first: 6)`, com o texto de `modules/audit/lib/describe.ts`. Só com `audit:read` | idem |

### `/members` (aba Membros)

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Lista | `MEMBERS` por organização; 15 por vez na tela | `organizationMembers(first, after)` com "Carregar mais" pelo `endCursor`. A busca e o filtro de papel são locais e não existem na API: filtram só as páginas carregadas (ou carregue todas antes de filtrar) | `modules/members/hooks/use-members.ts`, `containers/members-list.tsx` (`PAGE_SIZE`) |
| Linha "você" | `VIEWER_USER_IDS` por persona | O `id` do `me` | `modules/members/fixtures/members.ts` |
| Trocar papel | `markRoleChanged` e `mockActionError("PRIVILEGE_ESCALATION")` | `assignRole`; erros: `PRIVILEGE_ESCALATION`, `LAST_OWNER`, `MEMBER_NOT_FOUND` | `modules/members/containers/change-role-dialog.tsx` |
| Remover | `markRemoved` e `mockActionError("MEMBER_NOT_FOUND")` | `removeMember` | `modules/members/containers/members-list.tsx` |
| Sair | `mockActionError("LAST_OWNER")` | `leaveOrganization`; invalidar `myOrganizations` e trocar a organização ativa | idem |
| Store das mudanças | `changesStore` | Some | `modules/members/hooks/use-members.ts` |
| Papéis do select | `ORGANIZATION_ROLES` | `organizationRoles` (exige `roles:read`; sem ela, o select de troca não aparece) | `modules/access-control/hooks/use-organization-roles.ts` |

### `/members/invitations` (aba Convites)

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Lista | `ORGANIZATION_INVITATIONS` (`PENDING` e `EXPIRED`) | `organizationInvitations(first, after)` (paginada) | `modules/invitations/hooks/use-organization-invitations.ts` |
| Convidar e renovar | `markInvited` e `mockActionError("ALREADY_MEMBER")` | `inviteMember` com `roleId` (convidar de novo o mesmo e-mail renova). Erros: `ALREADY_MEMBER`, `INVITATION_LIMIT_REACHED`, `PRIVILEGE_ESCALATION` | `modules/invitations/containers/invite-member-dialog.tsx` |
| "Convidado por: Você" | `invitedByName: "Você"` | `invitedBy.name` da resposta | idem |
| Revogar | `markRevoked` e `mockActionError("INVITATION_NOT_FOUND")` | `revokeInvitation` | `modules/invitations/containers/organization-invitations.tsx` |

### `/settings`

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Salvar o nome | `renameOrganization` e `mockActionError("ORGANIZATION_PERMISSION_DENIED")` | `updateOrganization`; invalidar `myOrganizations` e `organization` | `modules/organizations/containers/organization-settings.tsx` |

### `/roles`, `/roles/new`, `/roles/[roleId]`

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Papéis | `ORGANIZATION_ROLES` (com `memberCount`) e `catalogStore` | `organizationRoles` (já traz `permissions` efetivas e `memberCount`) | `modules/access-control/hooks/use-organization-roles.ts` |
| Convites pendentes por papel (bloqueio da exclusão) | `pendingInvitationCount` na fixture | Contar a partir de `organizationInvitations` pelo `assignedRole.id`. **A lista é paginada: é preciso carregar todos os pendentes** (seguir o `endCursor` até `hasNextPage: false`) antes de contar. Exige `members:invite`; sem ela, deixar a API decidir (`ROLE_IN_USE`) | `modules/access-control/schemas/index.ts` (`pendingInvitationCount`), `containers/roles-list.tsx` (`deleteBlock`) |
| Catálogo do editor | `SYSTEM_PERMISSIONS` e `CUSTOM_PERMISSIONS` | `organizationPermissions` (sistema na ordem do catálogo, depois as personalizadas por chave; `isSystem`) | `modules/access-control/hooks/use-organization-catalog.ts` |
| Limite de papéis personalizados | 50, ou `DESIGN_LIMITS` reduzido no Atlântico | Fixo em `MAX_CUSTOM_ROLES` (a API não expõe); tirar o `DESIGN_LIMITS` | `modules/access-control/fixtures/permission-catalog.ts` |
| Criar | `saveRole` e `mockActionError(ROLE_LIMIT_REACHED, ROLE_NAME_TAKEN, PRIVILEGE_ESCALATION)` | `createRole` | `modules/access-control/containers/role-editor.tsx` |
| Editar | `saveRole` e `mockActionError(PRIVILEGE_ESCALATION, ROLE_NAME_TAKEN, SYSTEM_ROLE_IMMUTABLE)` | `updateRole` (mandar `name` só nos personalizados e `permissions` com o conjunto inteiro) | idem |
| Excluir | `deleteRole` e `mockActionError("ROLE_IN_USE")` | `deleteRole` | `modules/access-control/containers/roles-list.tsx` |
| Membros com o papel | `useMembers` filtrado | `organizationMembers` filtrado no cliente (não há filtro por papel na API) | `modules/members/containers/role-members-preview.tsx` |

### `/permissions`

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Catálogo | Fixtures e `catalogStore` | `organizationPermissions` | `modules/access-control/hooks/use-organization-catalog.ts` |
| "Concedida por N papéis" | Contada a partir dos papéis da fachada | Contar a partir de `organizationRoles` (o OWNER não conta); a API não tem esse campo | `modules/access-control/hooks/use-organization-roles.ts` (`rolesUsing`) |
| Limite | 100, ou 2 no Atlântico | Fixo em `MAX_CUSTOM_PERMISSIONS` | `modules/access-control/fixtures/permission-catalog.ts` |
| Criar | `mockActionError(PERMISSION_KEY_TAKEN, PERMISSION_LIMIT_REACHED, INVALID_PERMISSION_KEY, RESERVED_PERMISSION_RESOURCE)` | `createPermission` | `modules/access-control/containers/permissions-catalog.tsx` |
| Editar a descrição | `mockActionError("ORGANIZATION_PERMISSION_DENIED")` | `updatePermission` | idem |
| Excluir | `mockActionError("PERMISSION_IN_USE")` | `deletePermission` | idem |

### `/integrations`

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Lista | `INTEGRATIONS` e `integrationsStore` | `integrationClients` (`createdBy` pode ser nulo) | `modules/integrations/hooks/use-integrations.ts` |
| Limite | 5, ou `DESIGN_LIMITS` (1) no Atlântico | Fixo em `MAX_LIVE_INTEGRATIONS` (contam `ACTIVE` e `PROVISIONING`) | `modules/integrations/fixtures/integrations.ts` |
| Criar | `fakeClientId()`, `fakeClientSecret()` e `mockActionError(INTEGRATION_LIMIT_REACHED, PRIVILEGE_ESCALATION, INTEGRATION_PROVISIONING_FAILED)` | `createIntegrationClient`: guardar o `CreatedIntegrationClient` **só** no estado do diálogo do segredo (como hoje). Nunca no cache do React Query (use a mutation sem `setQueryData` com o segredo; invalide `integrationClients`), nem em log, store ou URL | `modules/integrations/containers/integrations.tsx`, `fixtures/fake-credentials.ts` |
| Provisionamento | A criação volta `ACTIVE` na hora | Igual na API: `createIntegrationClient` grava `PROVISIONING`, cria o app client e só responde depois de ativar. Se o Cognito falhar, a linha vira `FAILED` e a mutation devolve `INTEGRATION_PROVISIONING_FAILED`. `PROVISIONING` só aparece na lista para outra pessoa, durante uma criação em curso (ou se a marcação de `FAILED` falhar, até a reconciliação) | idem |
| Endpoint de token do exemplo | `TOKEN_ENDPOINT` fictício | A saída `token_endpoint` do Terraform (`infra/permanent/outputs.tf`), por variável de ambiente pública | `modules/integrations/fixtures/integrations.ts` |
| Revogar | `markRevoked` e `mockActionError("INTEGRATION_NOT_ACTIVE")` | `revokeIntegrationClient` | `modules/integrations/containers/integrations.tsx` |

### `/audit`, `/audit/decisions`, `/audit/security`

| Ponto | Hoje | Na 11b | Arquivo |
|---|---|---|---|
| Atividade | `AUDIT_EVENTS`, filtrada e paginada no cliente | `auditEvents(filter, first, after)`. Ações: `actions`; quem: `actorUserId`; período: `occurredFrom` (ver `lib/period.ts`). `details` chega como **string JSON**: fazer `JSON.parse` e validar com `auditDetailsSchema` no hook | `modules/audit/hooks/use-audit.ts`, `containers/audit-activity.tsx` |
| Decisões | `DECISIONS` | `authorizationDecisions(filter, first, after)`. Usuário: `subjectUserId`; integração: `clientId`; permissão: `permission` (chave exata); período: `decidedFrom`. Resultado: `allowed` direto ("Todos" não manda; "Permitido" é `true`; "Negado" é `false` e inclui as parciais). O badge "Parcial" da tabela vem de `results`, sem filtro próprio, para não quebrar a paginação | `containers/access-decisions.tsx` |
| Segurança | `SECURITY_EVENTS_BY_ORG` | `securityEvents(filter, first, after)`. Eventos: `events`; ator: `actorUserId` ou `actorClientId` (o valor do filtro é `user:<id>` ou `client:<id>`); período: `occurredFrom`. `details` também é string JSON | `containers/security-events.tsx` |
| Diretório de nomes | `AUDIT_DIRECTORY` | Montar com `organizationMembers` (`members:read`), `organizationRoles` (`roles:read`) e `integrationClients` (`integrations:read`). Sem a permissão, o texto cai no genérico ("um papel excluído", "um ex-membro"), como já acontece com ids desconhecidos | `modules/audit/hooks/use-audit.ts` |
| Opções dos filtros "Quem" e "Usuário" | Tiradas das fixtures | Do diretório (membros); a API filtra por id | idem |

## Limitações conhecidas que continuam na 11b

- O botão Voltar do navegador não passa pelo aviso de "Sair sem salvar?" do editor de papel: o App Router não
  permite barrar essa navegação. Cliques em links internos e fechar ou recarregar a aba estão cobertos
  (`shared/components/feedback/unsaved-changes-guard.tsx`).
- Os filtros (busca, papel, status, período) vivem no estado do componente, e não na URL. As abas são rotas, e o
  filtro de papel de Membros aceita `?role=`.
