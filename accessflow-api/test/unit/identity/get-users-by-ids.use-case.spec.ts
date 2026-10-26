import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUserRepository } from '@test/in-memory/identity/in-memory-user-repository';
import { makeUser } from '@test/factory/identity/make-user';
import { GetUsersByIdsUseCase } from '@/modules/identity/application/use-cases/get-users-by-ids.use-case';

const ANA_ID = '6f1c2a3e-0000-4000-8000-000000000001';
const BRUNO_ID = '6f1c2a3e-0000-4000-8000-000000000002';
const INEXISTENTE_ID = '6f1c2a3e-0000-4000-8000-000000000099';

let inMemoryUserRepository: InMemoryUserRepository;
let sut: GetUsersByIdsUseCase;

describe('GetUsersByIdsUseCase', () => {
  beforeEach(() => {
    inMemoryUserRepository = new InMemoryUserRepository([
      makeUser({ id: ANA_ID }),
      makeUser({
        id: BRUNO_ID,
        cognitoSub: 'sub-456',
        name: 'Bruno',
        email: 'bruno@example.com',
      }),
    ]);
    sut = new GetUsersByIdsUseCase(inMemoryUserRepository);
  });

  it('retorna lista vazia sem consultar o repositório', async () => {
    const findByIds = vi.spyOn(inMemoryUserRepository, 'findByIds');

    expect(await sut.execute([])).toEqual([]);
    expect(findByIds).not.toHaveBeenCalled();
  });

  it('consulta o repositório só com ids únicos', async () => {
    const findByIds = vi.spyOn(inMemoryUserRepository, 'findByIds');

    const users = await sut.execute([ANA_ID, BRUNO_ID, ANA_ID]);

    expect(findByIds).toHaveBeenCalledWith([ANA_ID, BRUNO_ID]);
    expect(users.map((user) => user.id).sort()).toEqual([ANA_ID, BRUNO_ID]);
  });

  it('ignora ids inexistentes', async () => {
    const users = await sut.execute([ANA_ID, INEXISTENTE_ID]);

    expect(users.map((user) => user.id)).toEqual([ANA_ID]);
  });
});
