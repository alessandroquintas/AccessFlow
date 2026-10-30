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

  // Nenhuma descrição ou exemplo do documento pode ter cifrão seguido de
  // crase, aspa simples, & ou outro cifrão. O @nestjs/swagger embute o
  // documento no swagger-ui-init.js com String.replace, que interpreta essas
  // sequências na substituição: cifrão e crase, por exemplo, colam o trecho
  // do template antes do marcador no meio do JSON, e o /docs abre em branco.
  // O /docs-json não passa por esse replace. O swagger.e2e compara os dois.
  const config = new DocumentBuilder()
    .setTitle('AccessFlow API — Integrações')
    .setDescription(
      'Rotas REST para sistemas externos vinculados a uma organização. ' +
        'Cada rota exige um token de máquina com o escopo indicado nela. ' +
        'Toda resposta traz o cabeçalho `X-Request-Id`: o enviado pelo ' +
        'cliente, se tiver de 8 a 64 caracteres entre letras, dígitos, ' +
        'ponto, sublinhado e hífen, ou um UUID gerado.',
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
