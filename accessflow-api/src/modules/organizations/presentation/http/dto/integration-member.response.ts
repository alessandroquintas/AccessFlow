import { ApiProperty } from '@nestjs/swagger';
import { IntegrationMembership } from '@/modules/organizations/application/dto/integration-membership';
import { MembershipRole } from '@/modules/organizations/domain/entities/membership.entity';

export class IntegrationMemberResponse {
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
    enum: MembershipRole,
    enumName: 'MembershipRole',
    description: 'Papel do usuário na organização.',
  })
  role!: MembershipRole;

  @ApiProperty({
    format: 'date-time',
    description: 'Quando o usuário entrou na organização.',
    example: '2026-01-02T00:00:00.000Z',
  })
  joinedAt!: string;

  static from(membership: IntegrationMembership): IntegrationMemberResponse {
    const response = new IntegrationMemberResponse();
    response.organizationId = membership.organizationId;
    response.userId = membership.userId;
    response.role = membership.role;
    response.joinedAt = membership.joinedAt.toISOString();
    return response;
  }
}
