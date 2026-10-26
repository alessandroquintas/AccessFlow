import { Membership } from '../entities/membership.entity';

export interface MembershipCursor {
  createdAt: Date;
  id: string;
}

export interface MembershipPage {
  items: Membership[];
  hasNextPage: boolean;
}

export abstract class MembershipRepository {
  abstract findByOrganizationAndUser(
    organizationId: string,
    userId: string,
  ): Promise<Membership | null>;

  abstract listActiveByUser(userId: string): Promise<Membership[]>;

  /**
   * Memberships ativos da organização, ordenados por `createdAt` e `id`
   * ascendentes. Com `after`, começa logo depois dessa posição.
   */
  abstract listActiveByOrganization(
    organizationId: string,
    options: { first: number; after?: MembershipCursor },
  ): Promise<MembershipPage>;

  /**
   * Marca o membership como REMOVED (a linha nunca é apagada).
   * Invariante: toda organização mantém pelo menos um OWNER ativo. Se o
   * membership for o último OWNER ativo, lança LastOwnerError e nada muda.
   * A checagem e a escrita são atômicas, mesmo com remoções concorrentes
   * na mesma organização.
   */
  abstract remove(membership: Membership): Promise<void>;
}
