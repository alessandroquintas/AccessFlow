import { Membership } from '../entities/membership.entity';
import { Organization } from '../entities/organization.entity';

export abstract class OrganizationRepository {
  abstract findById(id: string): Promise<Organization | null>;
  abstract findByIds(ids: string[]): Promise<Organization[]>;
  /**
   * Cria a organização e o membership OWNER do criador na mesma transação.
   * Lança SlugAlreadyTakenError se o slug já existir.
   */
  abstract createWithOwner(
    organization: Organization,
    owner: Membership,
  ): Promise<void>;

  abstract save(organization: Organization): Promise<void>;
}
