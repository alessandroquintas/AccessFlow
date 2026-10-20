import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserStatus } from '@/modules/identity/domain/entities/user.entity';
import { InvalidUserError } from '@/modules/identity/domain/errors/invalid-user.error';
import { UserInactiveError } from '@/modules/identity/domain/errors/user-inactive.error';
import { EmailNotVerifiedError } from '@/modules/identity/application/errors/email-not-verified.error';
import { InvalidAccessTokenError } from '@/modules/identity/application/errors/invalid-access-token.error';
import { InMemoryUserRepository } from '@test/in-memory/identity/in-memory-user-repository';
import { FakeIdentityProfileProvider } from '@test/fakes/identity/fake-identity-profile-provider';
import { makeUser } from '@test/factory/identity/make-user';
import { ProvisionUserUseCase } from '@/modules/identity/application/use-cases/provision-user.use.case';

let users: InMemoryUserRepository;
let profiles: FakeIdentityProfileProvider;
let sut: ProvisionUserUseCase;

const input = {
  cognitoSub: 'sub-ana',
  accessToken: 'token-ana',
  name: '  Ana Souza  ',
};

describe('ProvisionUserUseCase', () => {
  beforeEach(() => {
    users = new InMemoryUserRepository();
    profiles = new FakeIdentityProfileProvider();
    profiles.register('token-ana', {
      sub: 'sub-ana',
      email: 'Ana@Example.com',
    });
    sut = new ProvisionUserUseCase(users, profiles);
  });

  it('cria o perfil com nome do input e e-mail do provedor de identidade', async () => {
    const user = await sut.execute(input);

    expect(user.name).toBe('Ana Souza');
    expect(user.email).toBe('ana@example.com');
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(users.items).toHaveLength(1);
  });

  it('é idempotente: a segunda chamada devolve o mesmo perfil sem consultar o provedor', async () => {
    const first = await sut.execute(input);
    const second = await sut.execute({ ...input, name: 'Outro Nome' });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Ana Souza');
    expect(users.items).toHaveLength(1);
    expect(profiles.calls).toBe(1);
  });

  it('não reativa perfil inativo', async () => {
    users.items.push(
      makeUser({ cognitoSub: 'sub-ana', status: UserStatus.INACTIVE }),
    );

    await expect(sut.execute(input)).rejects.toBeInstanceOf(UserInactiveError);
  });

  it('recusa e-mail não verificado e não cria perfil', async () => {
    profiles.register('token-ana', {
      sub: 'sub-ana',
      email: 'ana@example.com',
      emailVerified: false,
    });

    await expect(sut.execute(input)).rejects.toBeInstanceOf(
      EmailNotVerifiedError,
    );
    expect(users.items).toHaveLength(0);
  });

  it('recusa quando o sub do provedor não bate com o do token', async () => {
    profiles.register('token-ana', {
      sub: 'sub-outra-pessoa',
      email: 'x@example.com',
    });

    await expect(sut.execute(input)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
    expect(users.items).toHaveLength(0);
  });

  it.each([
    ['vazio', '   '],
    ['curto demais', 'A'],
    ['longo demais', 'a'.repeat(101)],
  ])('recusa nome inválido: %s', async (_cenario, name) => {
    await expect(sut.execute({ ...input, name })).rejects.toBeInstanceOf(
      InvalidUserError,
    );
    expect(users.items).toHaveLength(0);
  });

  it('em corrida, devolve o perfil criado pela outra requisição', async () => {
    const createdByOther = makeUser({ cognitoSub: 'sub-ana' });
    users.items.push(createdByOther);
    // Simula a busca inicial acontecendo antes da outra requisição gravar.
    vi.spyOn(users, 'findByCognitoSub').mockResolvedValueOnce(null);

    const user = await sut.execute(input);

    expect(user.id).toBe(createdByOther.id);
    expect(users.items).toHaveLength(1);
  });
});
