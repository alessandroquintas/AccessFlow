import { Email } from '@/shared/domain/value-objects/email.vo';
import { UserRepository } from '../../domain/repositories/user.repository';

export class GetUserIdsByEmailUseCase {
  constructor(private readonly users: UserRepository) {}

  /**
   * Ids de todos os perfis com o e-mail, ativos ou não. O e-mail é
   * normalizado antes da busca; lança InvalidEmailError se for inválido.
   */
  async execute(email: string): Promise<string[]> {
    const users = await this.users.findByEmail(Email.create(email).value);

    return users.map((user) => user.id);
  }
}
