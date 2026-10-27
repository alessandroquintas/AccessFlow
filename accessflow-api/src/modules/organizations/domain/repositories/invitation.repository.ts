import { Invitation } from '../entities/invitation.entity';
import { Membership } from '../entities/membership.entity';

export interface InvitationCursor {
  createdAt: Date;
  id: string;
}

export interface InvitationPage {
  items: Invitation[];
  hasNextPage: boolean;
}

export abstract class InvitationRepository {
  abstract findById(id: string): Promise<Invitation | null>;

  /**
   * Grava um convite PENDING, numa transação travada na organização:
   * - se já existe PENDING (mesmo expirado) para o mesmo (organização,
   *   e-mail), renova esse convite em `now` com o papel e o autor do
   *   `candidate` e o devolve, sem criar outro;
   * - senão, se a organização já tem `maxPendingPerOrganization` convites
   *   pendentes e não expirados em `now`, lança InvitationLimitReachedError;
   * - senão, cria o `candidate` e o devolve.
   */
  abstract savePending(
    candidate: Invitation,
    options: { maxPendingPerOrganization: number; now: Date },
  ): Promise<Invitation>;

  /**
   * Convites PENDING da organização, expirados incluídos, ordenados por
   * `createdAt` e `id` descendentes (mais recentes primeiro).
   */
  abstract listPendingByOrganization(
    organizationId: string,
    options: { first: number; after?: InvitationCursor },
  ): Promise<InvitationPage>;

  /** Convites PENDING e não expirados em `now` para o e-mail informado. */
  abstract listPendingByEmail(email: string, now: Date): Promise<Invitation[]>;

  /**
   * Grava a resposta (DECLINED ou REVOKED) já aplicada na entidade, só se o
   * convite ainda estiver PENDING no banco. Senão, InvitationNotFoundError.
   */
  abstract respond(invitation: Invitation): Promise<void>;

  /**
   * Marca o convite (já ACCEPTED na entidade) como aceito e devolve o
   * membership do usuário na organização, decidido com o estado atual do
   * banco, dentro da mesma transação:
   * - membership ACTIVE: mantém papel e status;
   * - membership REMOVED: reativa com o papel do convite em `now`;
   * - sem membership: cria com o papel do convite em `now`.
   * Atômico; se o convite já não estiver PENDING no banco, lança
   * InvitationNotFoundError e nada muda.
   */
  abstract accept(
    invitation: Invitation,
    options: { userId: string; now: Date },
  ): Promise<Membership>;
}
