import { envSchema } from "./schema";

// NEXT_PUBLIC_* só chega ao client quando acessada de forma literal.
export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
