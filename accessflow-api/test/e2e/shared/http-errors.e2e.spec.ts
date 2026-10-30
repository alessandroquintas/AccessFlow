import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

let app: INestApplication;

const json = () =>
  request(app.getHttpServer())
    .post('/graphql')
    .set('Content-Type', 'application/json');

describe('Erros HTTP (e2e)', () => {
  beforeAll(async () => {
    app = await createTestApp(new FakeTokenVerifier());
  });

  afterAll(async () => {
    await app.close();
  });

  it('rota inexistente: 404 no formato padrão (ROUTE_NOT_FOUND), sem repetir o caminho', async () => {
    const res = await request(app.getHttpServer())
      .get('/rota-inexistente')
      .set('X-Request-Id', 'rota-404-abc');

    expect(res.status).toBe(404);
    expect(res.headers['x-request-id']).toBe('rota-404-abc');
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        reason: 'ROUTE_NOT_FOUND',
        message: 'Rota não encontrada.',
      },
    });
  });

  it('método sem rota (DELETE /v1/authorize) também é ROUTE_NOT_FOUND', async () => {
    const res = await request(app.getHttpServer()).delete('/v1/authorize');

    expect(res.status).toBe(404);
    expect(res.body.error.reason).toBe('ROUTE_NOT_FOUND');
  });

  it('URI malformada num parâmetro: BAD_REQUEST / MALFORMED_URI, antes da autenticação', async () => {
    const res = await request(app.getHttpServer()).get(
      '/v1/organizations/%E0%A4%A/members/abc',
    );

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'BAD_REQUEST',
        reason: 'MALFORMED_URI',
        message: 'O endereço da requisição está malformado.',
      },
    });
  });

  it('413: corpo acima do limite (100 KB do body-parser)', async () => {
    const res = await json().send(
      JSON.stringify({ query: `{ me { id } } #${'x'.repeat(200 * 1024)}` }),
    );

    expect(res.status).toBe(413);
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        reason: 'PAYLOAD_TOO_LARGE',
        message: 'O corpo da requisição excede o tamanho permitido.',
      },
    });
  });

  it.each([
    ['Content-Encoding desconhecido', { 'Content-Encoding': 'xyz' }],
    [
      'charset que o parser JSON não lê',
      { 'Content-Type': 'application/json; charset=latin1' },
    ],
  ])('415: %s', async (_, headers) => {
    const res = await json().set(headers).send('{"query":"{ me { id } }"}');

    expect(res.status).toBe(415);
    expect(res.body).toEqual({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        reason: 'UNSUPPORTED_MEDIA_TYPE',
        message:
          'A codificação ou o charset do corpo da requisição não é suportado.',
      },
    });
  });
});
