import { Invitation } from '../../domain/entities/invitation.entity';
import { OrganizationInvitation } from '../dto/organization-invitation';
import { UserDirectoryPort } from '../ports/user-directory.port';

/**
 * Junta a cada convite o nome de quem convidou, mantendo a ordem. Como na
 * listagem de membros, um convite sem perfil correspondente é omitido (não
 * deveria acontecer: a FK é Restrict e perfis não são apagados).
 */
export async function attachInviters(
  users: UserDirectoryPort,
  invitations: Invitation[],
): Promise<OrganizationInvitation[]> {
  const profiles = await users.getProfilesByIds(
    invitations.map((invitation) => invitation.invitedByUserId),
  );
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));

  return invitations.flatMap((invitation) => {
    const profile = byId.get(invitation.invitedByUserId);
    return profile
      ? [{ invitation, invitedBy: { userId: profile.id, name: profile.name } }]
      : [];
  });
}
