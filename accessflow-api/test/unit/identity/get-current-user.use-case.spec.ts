import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '@test/in-memory/identity/in-memory-user-repository';
import { makeUser, makeUserInactive } from '@test/factory/identity/make-user';
import { GetCurrentUserUseCase } from '@/modules/identity/application/use-cases/get-current-user.use-case';
import { UserInactiveError } from '@/modules/identity/domain/errors/user-inactive.error';
import { UserNotFoundError } from '@/modules/identity/domain/errors/user-not-found.error';

let inMemoryUserRepository: InMemoryUserRepository;
let sut: GetCurrentUserUseCase;

describe('GetCurrentUserUseCase', () => {
  beforeEach(() => {
    inMemoryUserRepository = new InMemoryUserRepository([
      makeUser(),
      makeUser({
        id: '6f1c2a3e-0000-4000-8000-000000000002',
        cognitoSub: 'sub-456',
        name: 'Bruno',
        email: 'bruno@example.com',
      }),
      makeUserInactive({ cognitoSub: 'sub-inativo' }),
    ]);
    sut = new GetCurrentUserUseCase(inMemoryUserRepository);
  });

  it('retorna o usuario quando existe e está ativo', async () => {
    const user = await sut.execute('sub-123');

    expect(user.email).toBe('ana@example.com');
  });

  it('lança UserNotFoundError quando o perfil não existir', async () => {
    const result = sut.execute('sub-inexistente');

    await expect(result).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('lança UserInactiveError quando o usuario está inativo', async () => {
    const user = sut.execute('sub-inativo');

    await expect(user).rejects.toBeInstanceOf(UserInactiveError);
  });

  it('retorna apenas o perfil correspondente ao sub informado', async () => {
    const user = await sut.execute('sub-456');

    expect(user.cognitoSub).toBe('sub-456');
    expect(user.email).toBe('bruno@example.com');
  });

  it('não retorna o perfil de outro usuário', async () => {
    const user = await sut.execute('sub-123');

    expect(user.cognitoSub).toBe('sub-123');
    expect(user.cognitoSub).not.toBe('sub-456');
    expect(user.email).not.toBe('bruno@example.com');
  });
});
