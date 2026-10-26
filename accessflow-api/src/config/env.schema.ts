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

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3333),
    DATABASE_URL: z.string().min(1),
    COGNITO_USER_POOL_ID: z
      .string()
      .regex(/^[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]+$/, 'formato inválido'),
    /** App clients de usuário (front-end, CLI de dev). */
    COGNITO_CLIENT_IDS: clientIdList,
    /** App clients de máquina (client credentials) das integrações. */
    COGNITO_MACHINE_CLIENT_IDS: clientIdList,
  })
  .superRefine((env, ctx) => {
    // Um client nas duas listas faria token de máquina valer como usuário.
    const shared = env.COGNITO_MACHINE_CLIENT_IDS.filter((id) =>
      env.COGNITO_CLIENT_IDS.includes(id),
    );

    if (shared.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['COGNITO_MACHINE_CLIENT_IDS'],
        message: 'um client de máquina não pode estar em COGNITO_CLIENT_IDS',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
