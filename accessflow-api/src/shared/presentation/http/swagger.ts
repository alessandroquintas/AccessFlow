import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { EnvService } from '@/config/env.service';

/** Nome do esquema de segurança usado por `@ApiBearerAuth` nas rotas de integração. */
export const MACHINE_TOKEN_SECURITY = 'machine-token';

/**
 * Publica a interface em `/docs` e a especificação em `/docs-json`, só fora
 * de produção: em produção a especificação seria um mapa da superfície de
 * ataque. Documenta apenas o REST; o GraphQL tem o próprio schema.
 */
export function setupSwagger(app: INestApplication, env: EnvService): void {
  if (env.get('NODE_ENV') === 'production') return;

  const config = new DocumentBuilder()
    .setTitle('AccessFlow API — Integrações')
    .setDescription(
      'Rotas REST para sistemas externos vinculados a uma organização. ' +
        'Cada rota exige um token de máquina com o escopo indicado nela. ' +
        'Toda resposta traz o cabeçalho `X-Request-Id`: o enviado pelo ' +
        'cliente, se casar com `^[A-Za-z0-9._-]{8,64}$`, ou um UUID gerado.',
    )
    .setVersion('v1')
    // Sem OAuth2 no Swagger UI: o client_secret nunca vai para o navegador.
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token do fluxo client credentials do Cognito, obtido fora do ' +
          'navegador com o client_id e o client_secret da integração. Precisa ' +
          'conter o escopo exigido pela rota.',
      },
      MACHINE_TOKEN_SECURITY,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    // Só JSON: o endpoint YAML não foi pedido e usaria o js-yaml.
    raw: ['json'],
  });
}
