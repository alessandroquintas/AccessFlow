import { randomUUID } from 'node:crypto';
import { InvalidCustomPermissionError } from '../errors/invalid-custom-permission.error';
import { ReservedPermissionResourceError } from '../errors/reserved-permission-resource.error';
import { PermissionDescription } from '../value-objects/permission-description.vo';
import { PermissionKey } from '../value-objects/permission-key.vo';
import { RESERVED_PERMISSION_RESOURCES } from '../../policies/organization-permission';

export interface CustomPermissionProps {
  id: string;
  organizationId: string;
  key: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomPermissionState extends Omit<
  CustomPermissionProps,
  'key' | 'description'
> {
  key: PermissionKey;
  description: PermissionDescription;
}

/**
 * Permissão definida por uma organização. A chave não muda depois de
 * criada; só a descrição. Criar não concede a ninguém além do OWNER.
 */
export class CustomPermission {
  static readonly MAX_PER_ORGANIZATION = 100;

  private constructor(private state: CustomPermissionState) {}

  /** Recurso reservado: ReservedPermissionResourceError. */
  static create(
    input: { organizationId: string; key: string; description: string },
    now: Date,
  ): CustomPermission {
    const key = PermissionKey.create(input.key);
    if (RESERVED_PERMISSION_RESOURCES.includes(key.resource)) {
      throw new ReservedPermissionResourceError(
        `O recurso "${key.resource}" é reservado ao sistema.`,
      );
    }

    return CustomPermission.restore({
      id: randomUUID(),
      organizationId: input.organizationId,
      key: key.value,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: CustomPermissionProps): CustomPermission {
    if (!props.id?.trim()) {
      throw new InvalidCustomPermissionError('id é obrigatório.');
    }

    if (!props.organizationId?.trim()) {
      throw new InvalidCustomPermissionError('organizationId é obrigatório.');
    }

    return new CustomPermission({
      ...props,
      key: PermissionKey.create(props.key),
      description: PermissionDescription.create(props.description),
    });
  }

  get id(): string {
    return this.state.id;
  }
  get organizationId(): string {
    return this.state.organizationId;
  }
  get key(): string {
    return this.state.key.value;
  }
  get description(): string {
    return this.state.description.value;
  }
  get createdAt(): Date {
    return this.state.createdAt;
  }
  get updatedAt(): Date {
    return this.state.updatedAt;
  }

  /** A mesma descrição, depois de normalizada, não muda nada. */
  changeDescription(description: string, now: Date): void {
    const next = PermissionDescription.create(description);
    if (next.value === this.description) return;

    this.state = { ...this.state, description: next, updatedAt: now };
  }
}
