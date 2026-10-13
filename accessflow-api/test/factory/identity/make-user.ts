import {
  User,
  UserStatus,
} from '@/modules/identity/domain/entities/user.entity';

export function makeUser(
  overrides: Partial<Parameters<typeof User.restore>[0]> = {},
) {
  const user = User.restore({
    id: '6f1c2a3e-0000-4000-8000-000000000001',
    cognitoSub: 'sub-123',
    name: 'Ana',
    email: 'ana@example.com',
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  });

  return user;
}

export function makeUserInactive(
  overrides: Partial<Parameters<typeof User.restore>[0]> = {},
) {
  const user = makeUser({ status: UserStatus.INACTIVE, ...overrides });

  return user;
}
