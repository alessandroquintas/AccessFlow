import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { EnvService } from '@/config/env.service';
import { setupSwagger } from '@/shared/presentation/http/swagger';

const MEMBER_PATH = '/v1/organizations/{organizationId}/members/{userId}';

// O Swagger precisa ser montado antes do init: depois dele, o 404 padrão do
// Nest já está registrado e as rotas novas nunca seriam alcançadas.
async function createAppWithSwagger(
  nodeEnv?: 'production',
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();

  const env = nodeEnv
    ? ({
        get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined),
      } as unknown as EnvService)
    : app.get(EnvService);

  setupSwagger(app, env);
  await app.init();
  return app;
}

describe('Swagger (e2e)', () => {
  describe('fora de produção', () => {
    let app: INestApplication;
    let spec: Record<string, any>;

    beforeAll(async () => {
      app = await createAppWithSwagger();
      const res = await request(app.getHttpServer()).get('/docs-json');
      expect(res.status).toBe(200);
      spec = res.body;
    });

    afterAll(async () => {
      await app.close();
    });

    it('documenta a rota de membros com parâmetros UUID', () => {
      const operation = spec.paths[MEMBER_PATH]?.get;

      expect(operation).toBeDefined();
      expect(operation.tags).toEqual(['Integrações — Membros']);
      expect(operation.description).toContain('accessflow-api/members.read');
      expect(
        operation.parameters.map((p: any) => [p.name, p.in, p.schema.format]),
      ).toEqual([
        ['organizationId', 'path', 'uuid'],
        ['userId', 'path', 'uuid'],
      ]);
    });

    it('documenta as respostas 200, 401, 403, 404 e 500', () => {
      const { responses } = spec.paths[MEMBER_PATH].get;

      expect(Object.keys(responses).sort()).toEqual([
        '200',
        '401',
        '403',
        '404',
        '500',
      ]);
      expect(responses['200'].content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/IntegrationMemberResponse',
      });
      for (const status of ['401', '403', '404', '500']) {
        expect(responses[status].description).toBeTruthy();
        expect(responses[status].content['application/json'].schema).toEqual({
          $ref: '#/components/schemas/ApiErrorResponse',
        });
      }
    });

    it('descreve o corpo de sucesso e o de erro', () => {
      const { IntegrationMemberResponse, ApiErrorBody } =
        spec.components.schemas;

      expect(IntegrationMemberResponse.properties.joinedAt.format).toBe(
        'date-time',
      );
      expect(spec.components.schemas.MembershipRole.enum).toEqual([
        'OWNER',
        'MEMBER',
        'CUSTOM',
      ]);
      expect(IntegrationMemberResponse.properties.roleId.format).toBe('uuid');
      expect(IntegrationMemberResponse.properties.roleName.type).toBe('string');
      expect(IntegrationMemberResponse.required).toEqual(
        expect.arrayContaining(['role', 'roleId', 'roleName']),
      );
      expect(ApiErrorBody.required).toEqual(['code', 'message']);
    });

    it('exige o esquema de segurança machine-token, sem OAuth2', () => {
      expect(spec.components.securitySchemes).toEqual({
        'machine-token': expect.objectContaining({
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }),
      });
      expect(spec.paths[MEMBER_PATH].get.security).toEqual([
        { 'machine-token': [] },
      ]);
    });

    it('documenta o POST /v1/authorize: escopo, corpo, exemplos e respostas', () => {
      const operation = spec.paths['/v1/authorize']?.post;

      expect(operation.tags).toEqual(['Integrações — Autorização']);
      expect(operation.description).toContain('accessflow-api/authorize');
      expect(operation.security).toEqual([{ 'machine-token': [] }]);
      expect(operation.requestBody.content['application/json']).toMatchObject({
        schema: { $ref: '#/components/schemas/AuthorizeRequest' },
        examples: { pedido: expect.any(Object) },
      });
      expect(Object.keys(operation.responses).sort()).toEqual([
        '200',
        '400',
        '401',
        '403',
        '404',
        '500',
      ]);
      expect(
        Object.keys(
          operation.responses['200'].content['application/json'].examples,
        ),
      ).toEqual(['tudoPermitido', 'parcial', 'naoMembro']);

      const { AuthorizeRequest } = spec.components.schemas;
      expect(AuthorizeRequest.properties.organizationId.format).toBe('uuid');
      expect(AuthorizeRequest.properties.permissions).toMatchObject({
        type: 'array',
        minItems: 1,
        maxItems: 25,
      });
    });

    it('não inclui o GraphQL', () => {
      expect(Object.keys(spec.paths).some((p) => p.includes('graphql'))).toBe(
        false,
      );
    });

    it('serve a interface em /docs e não serve YAML', async () => {
      const ui = await request(app.getHttpServer()).get('/docs');
      const yaml = await request(app.getHttpServer()).get('/docs-yaml');

      expect(ui.status).toBe(200);
      expect(ui.headers['content-type']).toContain('text/html');
      expect(yaml.status).toBe(404);
    });
  });

  describe('em produção', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createAppWithSwagger('production');
    });

    afterAll(async () => {
      await app.close();
    });

    it.each(['/docs', '/docs-json'])('%s responde 404', async (path) => {
      const res = await request(app.getHttpServer()).get(path);

      expect(res.status).toBe(404);
    });
  });
});
