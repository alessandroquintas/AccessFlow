import { Invitation } from '../../domain/entities/invitation.entity';
import { Organization } from '../../domain/entities/organization.entity';

/** Convite visto por quem o recebeu: sem o e-mail de quem convidou. */
export interface MyInvitation {
  invitation: Invitation;
  organization: Organization;
  invitedByName: string;
}
