import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

const INVALID_JSON = {
  error: {
    code: 'BAD_REQUEST',
    reason: 'INVALID_JSON',
    message: 'O corpo da requisição não é um JSON válido.',
  },
};

describe('Corpo JSON inválido (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(new FakeTokenVerifier());
  });

  afterAll(async () => {
    await app.close();
  });

  function postJson(path: string, body: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Content-Type', 'application/json')
      .send(body);
  }

  // O corpo é lido antes dos guards: o 400 vem mesmo sem token.
  it.each([
    ['REST, sem token', '/v1/authorize', '{oops'],
    ['GraphQL', '/graphql', '{oops'],
    [
      'JSON que não é objeto nem lista (modo strict do parser)',
      '/v1/authorize',
      '42',
    ],
  ])('%s: 400 no formato padrão', async (_, path, body) => {
    const res = await postJson(path, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(INVALID_JSON);
  });

  it('rota inexistente também no formato padrão (ROUTE_NOT_FOUND), sem repetir o caminho', async () => {
    const res = await request(app.getHttpServer()).get('/v1/nao-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        reason: 'ROUTE_NOT_FOUND',
        message: 'Rota não encontrada.',
      },
    });
  });
});
