import { describe, expect, it } from 'vitest';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { getRequest } from '@/shared/presentation/get-request';

describe('getRequest', () => {
  it('em HTTP devolve a requisição da rota', () => {
    const req = { headers: {} };
    const context = new ExecutionContextHost([req, {}, () => undefined]);
    context.setType('http');

    expect(getRequest(context)).toBe(req);
  });

  it('em GraphQL devolve o req do contexto do resolver', () => {
    const req = { headers: {} };
    const context = new ExecutionContextHost([{}, {}, { req }, {}]);
    context.setType('graphql');

    expect(getRequest(context)).toBe(req);
  });
});
