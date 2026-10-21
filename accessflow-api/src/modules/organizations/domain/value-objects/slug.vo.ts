import { InvalidOrganizationError } from '../errors/invalid-organization.error';

export class Slug {
  static readonly MIN_LENGTH = 3;
  static readonly MAX_LENGTH = 50;

  private static readonly PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  /** Palavras que conflitariam com rotas do front ou da API */
  private static readonly RESERVED = new Set([
    'admin',
    'api',
    'app',
    'auth',
    'docs',
    'graphql',
    'health',
    'login',
    'logout',
    'new',
    'settings',
    'signup',
    'wwww',
  ]);

  private constructor(readonly value: string) {}

  /** Para slug novos: valida formato da palavras reservadas. */
  static create(raw: string): Slug {
    const slug = Slug.restore(raw);

    if (Slug.RESERVED.has(slug.value)) {
      throw new InvalidOrganizationError('Este identificador é reservado');
    }

    return slug;
  }

  /** Para slugs já persistidos: valida só o formato. */
  static restore(raw: string): Slug {
    const value = raw.trim().toLowerCase() ?? '';

    if (value.length < Slug.MIN_LENGTH || value.length > Slug.MAX_LENGTH) {
      throw new InvalidOrganizationError(
        `Slug deve ter entre ${Slug.MIN_LENGTH} e ${Slug.MAX_LENGTH} caracteres.`,
      );
    }

    if (!Slug.PATTERN.test(value)) {
      throw new InvalidOrganizationError(
        `Slug deve conter apenas letras minúsculas, numros e hífens entre eles.`,
      );
    }

    return new Slug(value);
  }
}
