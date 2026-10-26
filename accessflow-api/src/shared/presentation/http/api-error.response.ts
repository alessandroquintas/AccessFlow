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
}

/** Corpo de toda resposta de erro das rotas REST. */
export class ApiErrorResponse {
  @ApiProperty({ type: ApiErrorBody })
  error!: ApiErrorBody;
}
