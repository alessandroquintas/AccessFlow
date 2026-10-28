import { InvalidPermissionKeyError } from '../errors/invalid-permission-key.error';

/**
 * Chave `recurso:ação`: minúsculas, dígitos e hífen, começando por letra,
 * até 40 caracteres de cada lado. Vale para as de sistema e as
 * personalizadas; recurso reservado é regra da permissão personalizada.
 */
export class PermissionKey {
  static readonly FORMAT = /^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,39}$/;

  private constructor(readonly value: string) {}

  static create(raw: string): PermissionKey {
    if (typeof raw !== 'string' || !PermissionKey.FORMAT.test(raw)) {
      throw new InvalidPermissionKeyError(
        'Chave de permissão deve ter o formato recurso:ação (minúsculas, dígitos e hífen, até 40 caracteres cada).',
      );
    }
    return new PermissionKey(raw);
  }

  static isValid(raw: string): boolean {
    return PermissionKey.FORMAT.test(raw);
  }

  get resource(): string {
    return this.value.slice(0, this.value.indexOf(':'));
  }

  get action(): string {
    return this.value.slice(this.value.indexOf(':') + 1);
  }
}
