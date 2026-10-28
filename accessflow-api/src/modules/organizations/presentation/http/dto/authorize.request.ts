import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { InvalidAuthorizationRequestError } from '@/modules/organizations/application/errors/invalid-authorization-request.error';
import { MAX_AUTHORIZE_PERMISSIONS } from '@/modules/organizations/application/use-cases/authorize-for-integration.use-case';
import { PermissionKey } from '@/modules/organizations/domain/value-objects/permission-key.vo';

/** Só os tipos; UUID, quantidade e formato das chaves são do caso de uso. */
const shape = z.object({
  organizationId: z.string(),
  userId: z.string(),
  permissions: z.array(z.string()),
});

export class AuthorizeRequest {
  @ApiProperty({
    format: 'uuid',
    description: 'Organização vinculada ao client de integração.',
    example: '6f1c2a3e-0000-4000-8000-000000000001',
  })
  organizationId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Usuário a consultar.',
    example: '6f1c2a3e-0000-4000-8000-000000000002',
  })
  userId!: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', pattern: PermissionKey.FORMAT.source },
    minItems: 1,
    maxItems: MAX_AUTHORIZE_PERMISSIONS,
    description:
      `De 1 a ${MAX_AUTHORIZE_PERMISSIONS} chaves recurso:ação (de sistema ou personalizadas). ` +
      'Repetidas são ignoradas. Chave em formato válido que não existe na organização não é erro: vem com allowed false.',
    example: ['invoices:approve', 'members:read'],
  })
  permissions!: string[];

  /** Valida os tipos do corpo; sem valores na mensagem de erro. */
  static parse(body: unknown): AuthorizeRequest {
    const result = shape.safeParse(body);
    if (!result.success) {
      const fields = [
        ...new Set(result.error.issues.map((i) => i.path[0] ?? 'corpo')),
      ];
      throw new InvalidAuthorizationRequestError(
        `Corpo inválido (${fields.join(', ')}): organizationId e userId são textos e permissions é uma lista de textos.`,
      );
    }
    return Object.assign(new AuthorizeRequest(), result.data);
  }
}
