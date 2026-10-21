import { Membership } from '../../domain/entities/membership.entity';
import { Organization } from '../../domain/entities/organization.entity';
import { OrganizationRepository } from '../../domain/repositories/organization.repository';
import { OrganizationWithMembership } from '../dto/organization-with-membership';
import { UserDirectoryPort } from '../ports/user-directory.port';

export interface CreateOrganizationInput {
  cognitoSub: string;
  name: string;
  slug: string;
}

export class CreateOrganizationUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly users: UserDirectoryPort,
  ) {}

  async execute(
    input: CreateOrganizationInput,
  ): Promise<OrganizationWithMembership> {
    const userId = await this.users.getActiveUserId(input.cognitoSub);

    const organization = Organization.create({
      name: input.name,
      slug: input.slug,
    });
    const owner = Membership.createOwner(organization.id, userId);

    await this.organizations.createWithOwner(organization, owner);

    return {
      organization,
      membership: owner,
    };
  }
}
