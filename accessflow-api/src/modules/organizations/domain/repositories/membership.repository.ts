import { Membership } from '../entities/membership.entity';
import { Role } from '../entities/role.entity';

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

  abstract create(membership: Membership): Promise<void>;

  /** Quantos memberships ativos cada papel da organização tem, por id. */
  abstract countActiveByRole(
    organizationId: string,
  ): Promise<Map<string, number>>;

  /**
   * Troca o papel de um membership ativo para `role` em `now`. Mesma
   * invariante e mesma atomicidade de `remove`: se ele é o último OWNER e
   * `role` não é OWNER, lança LastOwnerError e nada muda. Se ele é OWNER ou
   * não, lê-se no banco, depois de travar a organização.
   */
  abstract changeRole(
    membership: Membership,
    role: Role,
    now: Date,
  ): Promise<void>;

  /**
   * Marca o membership como REMOVED em `now` (a linha nunca é apagada).
   * Invariante: toda organização mantém pelo menos um OWNER ativo, isto é,
   * um membership ativo cujo papel tem systemKey OWNER. Se o membership for
   * o último, lança LastOwnerError e nada muda. A checagem e a escrita são
   * atômicas, mesmo com remoções concorrentes na mesma organização.
   */
  abstract remove(membership: Membership, now: Date): Promise<void>;
}
