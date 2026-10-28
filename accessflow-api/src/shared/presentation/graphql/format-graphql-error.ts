import type { GraphQLFormattedError } from 'graphql';

export function formatGraphqlError(
  formatted: GraphQLFormattedError,
  requestId?: string,
): GraphQLFormattedError {
  const code = formatted.extensions?.code;

  if (!code || code === 'INTERNAL_SERVER_ERROR') {
    // O requestId é o que liga a resposta mascarada ao log com os detalhes.
    return {
      message: 'Erro interno do servidor.',
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        ...(requestId && { requestId }),
      },
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
