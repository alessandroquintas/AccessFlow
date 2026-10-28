import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorBody {
  @ApiProperty({
    description: 'Categoria do erro, a mesma usada no GraphQL.',
    example: 'NOT_FOUND',
  })
  code!: string;

  @ApiPropertyOptional({
    description: 'Código de domínio. Ausente em erros internos.',
    example: 'MEMBER_NOT_FOUND',
  })
  reason?: string;

  @ApiProperty({ example: 'Membro não encontrado nesta organização.' })
  message!: string;

  @ApiPropertyOptional({
    description:
      'Id de correlação, o mesmo do cabeçalho X-Request-Id. Presente só no ' +
      'erro interno (500): é por ele que os detalhes são achados no log.',
    example: '3f6c1a52-9b7e-4d1f-8a2b-0c9d8e7f6a5b',
  })
  requestId?: string;
}

/** Corpo de toda resposta de erro das rotas REST. */
export class ApiErrorResponse {
  @ApiProperty({ type: ApiErrorBody })
  error!: ApiErrorBody;
}
