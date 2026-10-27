import { Invitation } from '../../domain/entities/invitation.entity';
import { Organization } from '../../domain/entities/organization.entity';
import { Role } from '../../domain/entities/role.entity';

/** Convite visto por quem o recebeu: sem o e-mail de quem convidou. */
export interface MyInvitation {
  invitation: Invitation;
  organization: Organization;
  invitedByName: string;
  /** Papel ao aceitar. */
  role: Role;
}
