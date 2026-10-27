import { Organization } from '../entities/organization.entity';

export abstract class OrganizationRepository {
  abstract findById(id: string): Promise<Organization | null>;
  abstract findByIds(ids: string[]): Promise<Organization[]>;

  /** Lança SlugAlreadyTakenError se o slug já existir. */
  abstract create(organization: Organization): Promise<void>;

  abstract save(organization: Organization): Promise<void>;

  /**
   * Trava a organização até o fim da transação ativa: quem travar depois
   * espera. Chamar dentro de TransactionManager.run, antes de checar
   * permissões que a escrita usa. Id que não é UUID não trava nada (nenhuma
   * organização tem esse id).
   */
  abstract lock(id: string): Promise<void>;
}
