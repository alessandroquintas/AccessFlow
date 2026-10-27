import { Invitation } from '../../domain/entities/invitation.entity';
import { Role } from '../../domain/entities/role.entity';

export interface InvitationInviter {
  userId: string;
  name: string;
}

/** Convite visto pela organização que o enviou. */
export interface OrganizationInvitation {
  invitation: Invitation;
  invitedBy: InvitationInviter;
  /** Papel ao aceitar. */
  role: Role;
}

export interface OrganizationInvitationsPage {
  items: OrganizationInvitation[];
  hasNextPage: boolean;
}
