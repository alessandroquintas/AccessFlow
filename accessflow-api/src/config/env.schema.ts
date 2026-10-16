import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1),
  COGNITO_USER_POOL_ID: z
    .string()
    .regex(/^[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]+$/, 'formato inválido'),
  COGNITO_CLIENT_IDS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string()).min(1, 'informe ao menos um client id')),
});

export type Env = z.infer<typeof envSchema>;
