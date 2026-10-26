import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaUserRepository } from '@/modules/identity/infrastructure/persistence/prisma-user.repository';
import {
  User,
  UserStatus,
} from '@/modules/identity/domain/entities/user.entity';
import { UserAlreadyExistsError } from '@/modules/identity/domain/errors/user-already-exists.error';

let prisma: PrismaService;
let sut: PrismaUserRepository;

describe('PrismaUserRepository (integração)', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    sut = new PrismaUserRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "users" CASCADE`;
  });

  it('retorna a entidade de domínio quando o cognitoSub existe', async () => {
    const created = await prisma.user.create({
      data: { cognitoSub: 'sub-123', name: 'Ana', email: 'ana@example.com' },
    });

    const user = await sut.findByCognitoSub('sub-123');

    expect(user).toBeInstanceOf(User);
    expect(user?.id).toBe(created.id);
    expect(user?.email).toBe('ana@example.com');
    expect(user?.status).toBe(UserStatus.ACTIVE);
  });

  it('retorna null quando o cognitoSub não existe', async () => {
    const user = await sut.findByCognitoSub('sub-inexistente');

    expect(user).toBeNull();
  });

  it('não retorna o perfil de outro usuário', async () => {
    await prisma.user.create({
      data: { cognitoSub: 'sub-B', name: 'Bruno', email: 'bruno@example.com' },
    });

    const user = await sut.findByCognitoSub('sub-A');

    expect(user).toBeNull();
  });

  it('mapeia corretamente o status INACTIVE', async () => {
    await prisma.user.create({
      data: {
        cognitoSub: 'sub-inativo',
        name: 'Carla',
        email: 'carla@example.com',
        status: 'INACTIVE',
      },
    });

    const user = await sut.findByCognitoSub('sub-inativo');

    expect(user?.status).toBe(UserStatus.INACTIVE);
    expect(user?.isActive()).toBe(false);
  });

  it('findByIds devolve só os usuários existentes', async () => {
    const ana = await prisma.user.create({
      data: { cognitoSub: 'sub-ana', name: 'Ana', email: 'ana@example.com' },
    });
    const bruno = await prisma.user.create({
      data: {
        cognitoSub: 'sub-bruno',
        name: 'Bruno',
        email: 'bruno@example.com',
      },
    });

    const users = await sut.findByIds([ana.id, bruno.id, crypto.randomUUID()]);

    expect(users.map((user) => user.id).sort()).toEqual(
      [ana.id, bruno.id].sort(),
    );
    expect(users.every((user) => user instanceof User)).toBe(true);
  });

  it('findByIds com lista vazia devolve lista vazia', async () => {
    expect(await sut.findByIds([])).toEqual([]);
  });

  it('persiste um usuário criado pelo domínio', async () => {
    const user = User.create({
      cognitoSub: 'sub-nova',
      name: 'Nova',
      email: 'nova@example.com',
    });

    await sut.create(user);

    const found = await sut.findByCognitoSub('sub-nova');
    expect(found?.id).toBe(user.id);
    expect(found?.email).toBe('nova@example.com');
  });

  it('save persiste o novo nome e atualiza updatedAt', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const user = User.create(
      { cognitoSub: 'sub-ana', name: 'Ana', email: 'ana@example.com' },
      createdAt,
    );
    await sut.create(user);

    const renamedAt = new Date('2026-03-01T10:00:00.000Z');
    user.rename('Ana Paula', renamedAt);
    await sut.save(user);

    const found = await sut.findByCognitoSub('sub-ana');
    expect(found?.id).toBe(user.id);
    expect(found?.name).toBe('Ana Paula');
    expect(found?.email).toBe('ana@example.com');
    expect(found?.createdAt).toEqual(createdAt);
    expect(found?.updatedAt).toEqual(renamedAt);
  });

  it('lança UserAlreadyExistsError para cognitoSub duplicado', async () => {
    await sut.create(
      User.create({
        cognitoSub: 'sub-dup',
        name: 'Primeira',
        email: 'a@example.com',
      }),
    );

    await expect(
      sut.create(
        User.create({
          cognitoSub: 'sub-dup',
          name: 'Segunda',
          email: 'b@example.com',
        }),
      ),
    ).rejects.toBeInstanceOf(UserAlreadyExistsError);
  });
});
