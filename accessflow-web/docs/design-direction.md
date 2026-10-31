# Direção visual do AccessFlow

O AccessFlow é o painel onde quem administra uma organização decide **quem pode fazer o quê** e confere
**quem fez o quê**. O público são pessoas técnicas ou de operações (líderes de time, TI, segurança) que
entram para uma tarefa precisa: convidar alguém, ajustar um papel, criar uma integração, investigar um
evento. O trabalho principal da interface é dar **confiança antes de uma mudança de acesso**: deixar
claro o que vai mudar, para quem, e o que não é possível mudar.

## Conceito: chaveiro e livro de registro

O vocabulário do produto é o de um chaveiro: chaves (`recurso:ação`), papéis que agrupam chaves,
integrações que recebem um segredo, e um livro onde cada abertura fica anotada. A direção visual tira
daí duas matérias:

- **Tinta azul-petróleo** — a cor de carimbo e de documento oficial. É a cor da ação e da navegação.
  Séria sem ser o azul genérico de SaaS, e distante do índigo padrão do shadcn.
- **Latão** — o metal das chaves. Aparece **só** onde há uma credencial ou um poder: o papel OWNER, o
  segredo de integração exibido uma única vez, a marca do produto. Por ser raro, sinaliza "isto é uma
  chave; trate com cuidado".

O resto é quieto: fundos levemente frios (papel, não creme), bordas finas, pouca sombra.

### O elemento memorável

A **chave de permissão**. Em toda a interface, uma permissão aparece no mesmo formato: o recurso em tom
apagado, os dois-pontos quase invisíveis e a ação em destaque, em fonte mono, numa etiqueta de canto
pouco arredondado:

```
 members:invite      →  [ members : invite ]
                           apagado   forte
```

É o que a pessoa lê para decidir, e é o que ela vê na API e nos logs. Tudo ao redor (cartões, tabelas,
menus) fica disciplinado para que essa etiqueta seja a coisa reconhecível do AccessFlow.

### Revisão do plano contra o brief

A primeira versão do plano usava um índigo como primária e Geist com Geist Mono. Revendo: é exatamente o
que sairia para qualquer painel feito com shadcn em Next.js, sem relação com acesso e chaves. Troquei
para o petróleo (tinta de documento) com latão como acento semântico, e para a IBM Plex (abaixo). Também
descartei um fundo creme quente (comum em interfaces geradas hoje) em favor de um branco frio de papel.

## Paleta

Tokens em oklch sobre as variáveis do shadcn (`src/app/globals.css`). Os neutros têm uma leve tinta fria
(matiz 230–245); nenhum cinza é neutro puro.

| Papel | Claro | Escuro | Uso |
|---|---|---|---|
| `background` | `oklch(0.985 0.004 230)` | `oklch(0.175 0.018 245)` | Fundo da página |
| `foreground` | `oklch(0.22 0.025 245)` | `oklch(0.945 0.008 230)` | Texto principal (tinta) |
| `card` / `popover` | `oklch(1 0 0)` | `oklch(0.205 0.02 245)` / `oklch(0.225 0.02 245)` | Superfícies elevadas |
| `primary` / `primary-foreground` | `oklch(0.46 0.085 210)` / `oklch(0.985 0.006 210)` | `oklch(0.62 0.065 215)` / `oklch(0.17 0.03 225)` | Petróleo: ação principal, links, item ativo |
| `muted-foreground` | `oklch(0.5 0.022 245)` | `oklch(0.72 0.02 240)` | Texto secundário |
| `accent` | `oklch(0.948 0.018 210)` | `oklch(0.29 0.035 215)` | Hover e item de menu ativo |
| `destructive` | `oklch(0.53 0.19 27)` | `oklch(0.68 0.17 25)` | Remover, revogar, excluir; erros |
| `success` | `oklch(0.5 0.11 160)` | `oklch(0.75 0.13 160)` | Ativo, aceito, permitido |
| `warning` | `oklch(0.55 0.13 55)` | `oklch(0.8 0.13 65)` | Pendente, em criação, expirando |
| `key` / `key-foreground` | `oklch(0.9 0.075 88)` / `oklch(0.4 0.075 70)` | `oklch(0.34 0.06 80)` / `oklch(0.9 0.09 88)` | Latão: credenciais e OWNER |
| `input` | `oklch(0.65 0.016 240)` | `oklch(0.52 0.022 245)` | Borda de campos (3:1 contra o fundo) |
| `border` | `oklch(0.905 0.01 235)` | `oklch(0.3 0.02 245)` | Divisórias e contornos de cartão |

**Contraste verificado** (WCAG 2.x, script de conversão oklch → sRGB): texto principal ≥ 15:1; texto
secundário ≥ 5,3:1 em todos os fundos; `destructive`, `success` e `warning` como texto ≥ 4,8:1;
`primary` como texto ≥ 6,5:1 (claro) e ≥ 5,0:1 (escuro); texto sobre `primary` 6,5:1 (claro) e 5,4:1 (escuro); `key-foreground` sobre `key` ≥ 6,9:1; borda de campo
≥ 3:1 (componente não textual).

**Primary no tema escuro (revisão):** a primeira versão, `oklch(0.76 0.095 205)`, era clara e saturada
demais e lia como turquesa nos botões. Baixou para `oklch(0.62 0.065 215)` (menos luz, menos croma, matiz
um pouco mais azul), que volta a ler como petróleo. Nessa luminosidade o texto branco ficaria em 3,4:1, então
o texto do botão continua escuro (`oklch(0.17 0.03 225)`, 5,4:1). Como texto (links) sobre o fundo: 5,3:1;
sobre cartão: 5,0:1; sobre a sidebar: 5,5:1. O anel de foco acompanhou: `oklch(0.58 0.06 215)`, 4,5:1 contra
o fundo.

**Regra de status:** cor nunca é o único sinal. Todo status leva texto ("Pendente", "Revogada") e, quando
ajuda, ícone.

## Tipografia

**Troca da Geist pela IBM Plex Sans + IBM Plex Mono.**

- A Geist é boa, mas é a fonte padrão do Next e do shadcn: deixaria o AccessFlow com a cara de qualquer
  projeto iniciado com eles.
- A Plex Sans é uma grotesca de desenho técnico (terminações cortadas em ângulo, "a" e "g" de dois
  andares) que soa institucional e confiável sem ser fria. Tem acentuação completa para pt-BR, algarismos
  tabulares para tabelas e eixo variável de peso, carregada pelo `next/font` sem dependência nova.
- A Plex Mono é da mesma família, então a chave de permissão, o `client_id` e o `requestId` conversam com
  o texto ao redor em vez de parecerem colados de um terminal.

**Regra para a mono:** só para identificadores de máquina que a pessoa pode copiar ou comparar (chaves de
permissão, escopos, `client_id`, `requestId`, slugs). Nunca para rótulos, títulos ou números comuns.

Escala (base 14 px no painel, que é denso; 16 px nas páginas públicas):

| Token | Tamanho / altura | Peso | Uso |
|---|---|---|---|
| `text-2xl` | 24 / 32 | 600 | Título da página |
| `text-lg` | 18 / 28 | 600 | Título de seção e de diálogo |
| `text-base` | 16 / 24 | 400 | Texto corrido nas páginas públicas |
| `text-sm` | 14 / 20 | 400–500 | Corpo do painel, tabelas, campos |
| `text-xs` | 12 / 16 | 500 | Cabeçalho de tabela, metadados, badges |

Sem caixa-alta em rótulos e sem palavras destacadas no meio de títulos. Títulos em caixa de frase.

## Raio

`--radius: 0.5rem`, com a escala do shadcn derivada dele. A hierarquia vem do raio:

- **4 px** (`rounded-sm`): chave de permissão e etiquetas técnicas, que parecem uma etiqueta de chaveiro;
- **6–8 px** (`rounded-md`/`rounded-lg`): botões, campos, itens de menu;
- **11 px** (`rounded-xl`): cartões e diálogos;
- **pílula**: só badges de status.

## Densidade de tabelas

As listas (membros, convites, papéis, auditoria) são a maior parte do produto, então a densidade é de
ferramenta, não de página de marketing:

- linha de 40 px (`h-10`) com 14 px de texto; cabeçalho de 36 px em 12 px, peso 500, cor secundária,
  caixa de frase;
- números e datas com `tabular-nums`, números alinhados à direita;
- uma ação primária visível por linha, no máximo; as demais num menu "Mais ações";
- a tabela rola dentro do próprio contêiner; a página nunca rola na horizontal;
- abaixo de 640 px, colunas secundárias somem e o dado essencial vira duas linhas na mesma célula.

## Ícones

Lucide (o `iconLibrary` do projeto), traço padrão, dimensionado pelos componentes. Um ícone por conceito,
sempre o mesmo:

| Conceito | Ícone |
|---|---|
| Organização | `Building2` |
| Membros | `Users` |
| Convites | `MailPlus` |
| Papéis | `ShieldCheck` |
| Permissões | `KeyRound` |
| Integrações | `Cable` |
| Auditoria | `ScrollText` |
| Configurações | `Settings` |
| Bloqueado por permissão | `Lock` |

Ícone sozinho só em botão de ação conhecida (fechar, copiar, mais ações), sempre com `aria-label`.

## Tom dos textos

- **pt-BR, segunda pessoa ("você"), caixa de frase, voz ativa.** Sem jargão de implementação na UI: a
  pessoa "convida um membro", não "cria um invitation".
- **O botão diz o que acontece, e o toast repete o mesmo verbo:** "Revogar convite" → "Convite revogado".
- **Glossário fixo:** organização, membro, papel, permissão, convite, integração, registro de auditoria.
  "Papel" (nunca "função" ou "cargo"); "permissão" é a chave `recurso:ação`.
- **Confirmações dizem a consequência:** "Remover Ana Lima? Ela perde o acesso a Cooperativa Vale Verde
  na hora. Para voltar, precisará de um novo convite."
- **Erros dizem o que houve e o que fazer**, sem pedir desculpas e sem vagueza: "Já existe um papel com
  esse nome. Escolha outro nome."
- **Vazio é convite à ação:** "Nenhum convite pendente. Convide alguém para a organização."
- **Sem permissão é afirmativo e neutro:** "Você não tem permissão para ver isto. Peça a um OWNER da
  organização."

## Movimento

Só o que responde a uma ação: abrir diálogo, expandir, confirmar uma cópia. Nada de entrada animada de
seções. Com `prefers-reduced-motion: reduce`, uma regra global no `globals.css` reduz animações e
transições a praticamente zero.

## Onde ver

`/design` (somente fora de produção): tokens, tipografia e componentes base, lado a lado nos temas claro
e escuro.
