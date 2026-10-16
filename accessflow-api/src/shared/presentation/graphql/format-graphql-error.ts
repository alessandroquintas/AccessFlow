import type { GraphQLFormattedError } from 'graphql';

export function formatGraphqlError(
  formatted: GraphQLFormattedError,
): GraphQLFormattedError {
  const code = formatted.extensions?.code;

  if (!code || code === 'INTERNAL_SERVER_ERROR') {
    return {
      message: 'Erro interno do servidor.',
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    };
  }

  return {
    message: formatted.message,
    path: formatted.path,
    extensions: {
      code,
      reason: formatted.extensions?.reason,
    },
  };
}
