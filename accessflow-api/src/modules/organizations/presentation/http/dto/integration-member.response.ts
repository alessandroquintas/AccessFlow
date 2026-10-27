import { ApiProperty } from '@nestjs/swagger';
import { IntegrationMembership } from '@/modules/organizations/application/dto/integration-membership';
import { MembershipRole, membershipRoleOf } from '../../membership-role';

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
    description:
      'Papel do usuário na organização. CUSTOM: papel personalizado (veja roleId e roleName).',
  })
  role!: MembershipRole;

  @ApiProperty({
    format: 'uuid',
    description: 'Papel atribuído, de sistema ou personalizado.',
    example: '6f1c2a3e-0000-4000-8000-000000000003',
  })
  roleId!: string;

  @ApiProperty({ description: 'Nome do papel.', example: 'Financeiro' })
  roleName!: string;

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
    response.role = membershipRoleOf(membership.role);
    response.roleId = membership.role.id;
    response.roleName = membership.role.name;
    response.joinedAt = membership.joinedAt.toISOString();
    return response;
  }
}
