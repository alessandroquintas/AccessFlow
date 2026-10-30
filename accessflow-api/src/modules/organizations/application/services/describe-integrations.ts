import { IntegrationClient } from '../../domain/entities/integration-client.entity';
import { IntegrationClientEntry } from '../dto/integration-client-entry';
import { UserDirectoryPort } from '../ports/user-directory.port';

/**
 * Junta a cada integração o nome de quem a criou, numa consulta só e
 * mantendo a ordem. Sem criador gravado, ou sem o perfil, createdBy é nulo.
 */
export async function describeIntegrations(
  users: UserDirectoryPort,
  integrations: IntegrationClient[],
): Promise<IntegrationClientEntry[]> {
  const creatorIds = [
    ...new Set(
      integrations.flatMap((integration) =>
        integration.createdByUserId ? [integration.createdByUserId] : [],
      ),
    ),
  ];
  const profiles =
    creatorIds.length > 0 ? await users.getProfilesByIds(creatorIds) : [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return integrations.map((integration) => {
    const profile = integration.createdByUserId
      ? profileById.get(integration.createdByUserId)
      : undefined;
    return {
      integration,
      createdBy: profile ? { userId: profile.id, name: profile.name } : null,
    };
  });
}
