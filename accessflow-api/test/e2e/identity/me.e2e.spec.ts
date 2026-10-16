import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

const ME_QUERY = '{ me { id name email status createdAt } }';

let app: INestApplication;
let prisma: PrismaService;
let tokens: FakeTokenVerifier;

function graphql(query: string, authorization?: string) {
  const req = request(app.getHttpServer())
    .post('/graphql')
    .set('Content-Type', 'application/json');

  if (authorization !== undefined) req.set('Authorization', authorization);

  return req.send({ query });
}

function createUser(data: {
  cognitoSub: string;
  name: string;
  email: string;
  status?: 'ACTIVE' | 'INACTIVE';
}) {
  return prisma.user.create({ data });
}

describe('Query me (e2e)', () => {
  beforeAll(async () => {
    tokens = new FakeTokenVerifier();
    app = await createTestApp(tokens);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    tokens.reset();
    await prisma.$executeRaw`TRUNCATE TABLE "users" CASCADE`;
  });

  describe('sucesso', () => {
    it('retorna o perfil do usuário autenticado', async () => {
      const user = await createUser({
        cognitoSub: 'sub-ana',
        name: 'Ana',
        email: 'ana@example.com',
      });
      tokens.register('token-ana', { sub: 'sub-ana' });

      const res = await graphql(ME_QUERY, 'Bearer token-ana');

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.me).toEqual({
        id: user.id,
        name: 'Ana',
        email: 'ana@example.com',
        status: 'ACTIVE',
        createdAt: user.createdAt.toISOString(),
      });
    });

    it('cada token retorna apenas o próprio perfil (usuário A vs. B)', async () => {
      await createUser({
        cognitoSub: 'sub-a',
        name: 'Ana',
        email: 'ana@example.com',
      });
      await createUser({
        cognitoSub: 'sub-b',
        name: 'Bruno',
        email: 'bruno@example.com',
      });
      tokens.register('token-a', { sub: 'sub-a' });
      tokens.register('token-b', { sub: 'sub-b' });

      const resA = await graphql(ME_QUERY, 'Bearer token-a');
      const resB = await graphql(ME_QUERY, 'Bearer token-b');

      expect(resA.body.data.me.email).toBe('ana@example.com');
      expect(resB.body.data.me.email).toBe('bruno@example.com');
    });
  });

  describe('contrato da API', () => {
    it('não expõe o cognitoSub', async () => {
      const res = await graphql('{ me { cognitoSub } }', 'Bearer qualquer');

      expect(res.body.errors[0].extensions.code).toBe(
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('não aceita argumentos para escolher o usuário', async () => {
      const res = await graphql(
        '{ me(cognitoSub: "sub-b") { id } }',
        'Bearer qualquer',
      );

      expect(res.body.errors[0].extensions.code).toBe(
        'GRAPHQL_VALIDATION_FAILED',
      );
    });
  });

  describe('autenticação', () => {
    it('rejeita requisição sem header Authorization', async () => {
      const res = await graphql(ME_QUERY);

      expect(res.body.data).toBeNull();
      expect(res.body.errors[0].extensions).toEqual({
        code: 'UNAUTHENTICATED',
        reason: 'INVALID_ACCESS_TOKEN',
      });
    });

    it.each([
      ['esquema diferente de Bearer', 'Token token-ana'],
      ['esquema com erro de digitação', 'Berear token-ana'],
      ['Bearer sem token', 'Bearer'],
      ['token com partes extras', 'Bearer token-ana extra'],
    ])('rejeita header malformado: %s', async (_cenario, header) => {
      tokens.register('token-ana', { sub: 'sub-ana' });

      const res = await graphql(ME_QUERY, header);

      expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });

    it('rejeita token recusado pelo verificador (expirado, ID token, outro client)', async () => {
      const res = await graphql(ME_QUERY, 'Bearer token-desconhecido');

      expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('regras de acesso', () => {
    it('bloqueia usuário inativo', async () => {
      await createUser({
        cognitoSub: 'sub-carla',
        name: 'Carla',
        email: 'carla@example.com',
        status: 'INACTIVE',
      });
      tokens.register('token-carla', { sub: 'sub-carla' });

      const res = await graphql(ME_QUERY, 'Bearer token-carla');

      expect(res.body.data).toBeNull();
      expect(res.body.errors[0].extensions).toEqual({
        code: 'FORBIDDEN',
        reason: 'USER_INACTIVE',
      });
    });

    it('retorna NOT_FOUND e não cria perfil automaticamente', async () => {
      tokens.register('token-novo', { sub: 'sub-sem-perfil' });

      const res = await graphql(ME_QUERY, 'Bearer token-novo');

      expect(res.body.errors[0].extensions).toEqual({
        code: 'NOT_FOUND',
        reason: 'USER_NOT_FOUND',
      });
      expect(await prisma.user.count()).toBe(0);
    });
  });

  describe('segurança das respostas de erro', () => {
    it('mascara erros inesperados sem vazar detalhes internos', async () => {
      const logSpy = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      tokens.failWith(new Error('falha interna com detalhe sensível'));

      const res = await graphql(ME_QUERY, 'Bearer qualquer');

      expect(res.body.errors[0]).toEqual({
        message: 'Erro interno do servidor.',
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
      expect(JSON.stringify(res.body)).not.toContain('sensível');
      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });
});
