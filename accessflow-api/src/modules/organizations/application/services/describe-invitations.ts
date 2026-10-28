import { Invitation } from '../../domain/entities/invitation.entity';
import { RoleRepository } from '../../domain/repositories/role.repository';
import { OrganizationInvitation } from '../dto/organization-invitation';
import { UserDirectoryPort } from '../ports/user-directory.port';
import { rolesById } from './roles-by-id';

/**
 * Junta a cada convite o nome de quem convidou e o papel, mantendo a ordem.
 * Como na listagem de membros, um convite sem perfil ou papel
 * correspondente é omitido (não deveria acontecer: as FKs são Restrict e
 * perfis e papéis não são apagados fisicamente).
 */
export async function describeInvitations(
  users: UserDirectoryPort,
  roles: RoleRepository,
  invitations: Invitation[],
): Promise<OrganizationInvitation[]> {
  const [profiles, roleById] = await Promise.all([
    users.getProfilesByIds(
      invitations.map((invitation) => invitation.invitedByUserId),
    ),
    rolesById(
      roles,
      invitations.map((invitation) => invitation.roleId),
    ),
  ]);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const result = invitations.flatMap((invitation) => {
    const profile = profileById.get(invitation.invitedByUserId);
    const role = roleById.get(invitation.roleId);
    return profile && role
      ? [
          {
            invitation,
            invitedBy: { userId: profile.id, name: profile.name },
            role,
          },
        ]
      : [];
  });

  return result;
}
