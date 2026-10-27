import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUserRepository } from '@test/in-memory/identity/in-memory-user-repository';
import { makeUser, makeUserInactive } from '@test/factory/identity/make-user';
import { GetUserIdsByEmailUseCase } from '@/modules/identity/application/use-cases/get-user-ids-by-email.use-case';
import { InvalidEmailError } from '@/shared/domain/errors/invalid-email.error';

const ANA_ID = '6f1c2a3e-0000-4000-8000-000000000001';
const ANA_2_ID = '6f1c2a3e-0000-4000-8000-000000000002';
const BRUNO_ID = '6f1c2a3e-0000-4000-8000-000000000003';

let users: InMemoryUserRepository;
let sut: GetUserIdsByEmailUseCase;

describe('GetUserIdsByEmailUseCase', () => {
  beforeEach(() => {
    users = new InMemoryUserRepository([
      makeUser({ id: ANA_ID }),
      // O e-mail não é único: outro perfil, inativo, com o mesmo e-mail.
      makeUserInactive({ id: ANA_2_ID, cognitoSub: 'sub-ana-2' }),
      makeUser({
        id: BRUNO_ID,
        cognitoSub: 'sub-bruno',
        email: 'bruno@example.com',
      }),
    ]);
    sut = new GetUserIdsByEmailUseCase(users);
  });

  it('devolve todos os perfis com o e-mail, inativos incluídos', async () => {
    const ids = await sut.execute('ana@example.com');

    expect(ids.sort()).toEqual([ANA_ID, ANA_2_ID]);
  });

  it('normaliza o e-mail antes de buscar', async () => {
    const findByEmail = vi.spyOn(users, 'findByEmail');

    expect(await sut.execute('  BRUNO@Example.com ')).toEqual([BRUNO_ID]);
    expect(findByEmail).toHaveBeenCalledWith('bruno@example.com');
  });

  it('devolve lista vazia quando ninguém tem o e-mail', async () => {
    expect(await sut.execute('carla@example.com')).toEqual([]);
  });

  it('recusa e-mail inválido sem consultar o repositório', async () => {
    const findByEmail = vi.spyOn(users, 'findByEmail');

    await expect(sut.execute('ana@')).rejects.toBeInstanceOf(InvalidEmailError);
    expect(findByEmail).not.toHaveBeenCalled();
  });
});
