import { Invitation } from '../../domain/entities/invitation.entity';

export interface InvitationInviter {
  userId: string;
  name: string;
}

/** Convite visto pela organização que o enviou. */
export interface OrganizationInvitation {
  invitation: Invitation;
  invitedBy: InvitationInviter;
}

export interface OrganizationInvitationsPage {
  items: OrganizationInvitation[];
  hasNextPage: boolean;
}
