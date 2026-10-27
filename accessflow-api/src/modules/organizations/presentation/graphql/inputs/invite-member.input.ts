import { MembershipRole } from '@/modules/organizations/domain/entities/membership.entity';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class InviteMemberInput {
  @Field({ description: 'E-mail da pessoa convidada.' })
  email!: string;

  @Field(() => MembershipRole, {
    description: 'Papel ao aceitar. Convidar como OWNER exige ser OWNER.',
  })
  role!: MembershipRole;
}
