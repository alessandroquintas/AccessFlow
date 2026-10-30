import { z } from 'zod';

const clientIdList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string()).min(1, 'informe ao menos um client id'));

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  /**
   * Segundos entre o SIGTERM e o fechamento do HTTP, com o readiness já em
   * 503, para o balanceador tirar a task antes de as conexões serem
   * recusadas. 0 fecha logo.
   */
  SHUTDOWN_DRAIN_SECONDS: z.coerce.number().int().min(0).max(60).default(0),
  DATABASE_URL: z.string().min(1),
  COGNITO_USER_POOL_ID: z
    .string()
    .regex(/^[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]+$/, 'formato inválido'),
  /**
   * App clients de usuário (front-end, CLI de dev). Não há lista de clients
   * de máquina: qualquer outro app client do pool autentica como máquina, e
   * o vínculo em integration_clients autoriza.
   */
  COGNITO_CLIENT_IDS: clientIdList,
});

export type Env = z.infer<typeof envSchema>;
