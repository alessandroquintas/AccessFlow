import { MembershipRole } from '../../membership-role';
import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class InviteMemberInput {
  @Field({ description: 'E-mail da pessoa convidada.' })
  email!: string;

  @Field(() => MembershipRole, {
    nullable: true,
    description: 'Papel ao aceitar. Convidar como OWNER exige ser OWNER.',
  })
  role?: MembershipRole | null;

  @Field(() => ID, {
    nullable: true,
    description:
      'Qualquer papel da organização, inclusive personalizado. Informe role ou roleId, só um deles. Exige ter todas as permissões do papel.',
  })
  roleId?: string | null;
}
