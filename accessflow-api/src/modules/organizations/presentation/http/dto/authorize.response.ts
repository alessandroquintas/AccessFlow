import { ApiProperty } from '@nestjs/swagger';
import { IntegrationAuthorization } from '@/modules/organizations/application/dto/integration-authorization';

export class AuthorizeResult {
  @ApiProperty({ example: 'invoices:approve' })
  permission!: string;

  @ApiProperty({ example: true })
  allowed!: boolean;
}

export class AuthorizeResponse {
  @ApiProperty({
    format: 'uuid',
    example: '6f1c2a3e-0000-4000-8000-000000000001',
  })
  organizationId!: string;

  @ApiProperty({
    format: 'uuid',
    example: '6f1c2a3e-0000-4000-8000-000000000002',
  })
  userId!: string;

  @ApiProperty({
    description: 'true só se todas as chaves forem permitidas.',
    example: true,
  })
  allowed!: boolean;

  @ApiProperty({
    type: [AuthorizeResult],
    description: 'Uma entrada por chave, na ordem do pedido, sem as repetidas.',
  })
  results!: AuthorizeResult[];

  static from(result: IntegrationAuthorization): AuthorizeResponse {
    const response = new AuthorizeResponse();
    response.organizationId = result.organizationId;
    response.userId = result.userId;
    response.allowed = result.allowed;
    response.results = result.results.map(({ permission, allowed }) => ({
      permission,
      allowed,
    }));
    return response;
  }
}
