import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FakeTokenVerifier } from '@test/fakes/identity/fake-token-verifier';
import { createTestApp } from '@test/e2e/setup/create-test-e2e-app';

let app: INestApplication;

describe('Erros HTTP (e2e)', () => {
  beforeAll(async () => {
    app = await createTestApp(new FakeTokenVerifier());
  });

  afterAll(async () => {
    await app.close();
  });

  it('rota inexistente mantém o 404 padrão do Nest', async () => {
    const res = await request(app.getHttpServer()).get('/rota-inexistente');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Cannot GET /rota-inexistente',
      error: 'Not Found',
    });
  });
});
