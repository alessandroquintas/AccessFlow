import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUserRepository } from '@test/in-memory/identity/in-memory-user-repository';
import { makeUser, makeUserInactive } from '@test/factory/identity/make-user';
import { GetCurrentUserUseCase } from '@/modules/identity/application/use-cases/get-current-user.use-case';
import { UpdateMyProfileUseCase } from '@/modules/identity/application/use-cases/update-my-profile.use-case';
import { InvalidUserError } from '@/modules/identity/domain/errors/invalid-user.error';
import { UserInactiveError } from '@/modules/identity/domain/errors/user-inactive.error';
import { UserNotFoundError } from '@/modules/identity/domain/errors/user-not-found.error';

let inMemoryUserRepository: InMemoryUserRepository;
let sut: UpdateMyProfileUseCase;

describe('UpdateMyProfileUseCase', () => {
  beforeEach(() => {
    inMemoryUserRepository = new InMemoryUserRepository([
      makeUser(),
      makeUserInactive({
        id: '6f1c2a3e-0000-4000-8000-000000000002',
        cognitoSub: 'sub-inativo',
      }),
    ]);
    sut = new UpdateMyProfileUseCase(
      inMemoryUserRepository,
      new GetCurrentUserUseCase(inMemoryUserRepository),
    );
  });

  it('renomeia o próprio perfil e atualiza updatedAt', async () => {
    const user = await sut.execute({
      cognitoSub: 'sub-123',
      name: '  Ana Paula ',
    });

    expect(user.name).toBe('Ana Paula');
    expect(user.updatedAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01').getTime(),
    );
    const stored = await inMemoryUserRepository.findByCognitoSub('sub-123');
    expect(stored?.name).toBe('Ana Paula');
    expect(stored?.email).toBe('ana@example.com');
  });

  it.each([
    ['curto demais', 'A'],
    ['só espaços', '    '],
    ['longo demais', 'a'.repeat(101)],
  ])('nome inválido (%s) não grava nada', async (_cenario, name) => {
    const save = vi.spyOn(inMemoryUserRepository, 'save');

    await expect(
      sut.execute({ cognitoSub: 'sub-123', name }),
    ).rejects.toBeInstanceOf(InvalidUserError);

    expect(save).not.toHaveBeenCalled();
    const stored = await inMemoryUserRepository.findByCognitoSub('sub-123');
    expect(stored?.name).toBe('Ana');
  });

  it('lança UserInactiveError para perfil inativo', async () => {
    const save = vi.spyOn(inMemoryUserRepository, 'save');

    await expect(
      sut.execute({ cognitoSub: 'sub-inativo', name: 'Outro Nome' }),
    ).rejects.toBeInstanceOf(UserInactiveError);

    expect(save).not.toHaveBeenCalled();
  });

  it('lança UserNotFoundError quando o perfil não existe', async () => {
    await expect(
      sut.execute({ cognitoSub: 'sub-inexistente', name: 'Outro Nome' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
