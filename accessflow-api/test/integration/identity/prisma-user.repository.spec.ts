import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { PrismaUserRepository } from '@/modules/identity/infrastructure/persistence/prisma-user.repository';
import {
  User,
  UserStatus,
} from '@/modules/identity/domain/entities/user.entity';

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
});
