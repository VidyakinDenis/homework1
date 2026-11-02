import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'prod']).default('dev'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  PG_HOST: z.string().min(1, 'PG_HOST is required'),
  PG_PORT: z.coerce.number().int().min(1).max(65535),
  PG_USER: z.string().min(1, 'PG_USER is required'),
  PG_USER_PASS: z.string().min(1, 'PG_USER_PASS is required'),
  PG_DB: z.string().min(1, 'PG_DB is required'),

  JWT_ACCESS_KEY: z.string().min(1, 'JWT_ACCESS_KEY is required'),
  JWT_REFRESH_KEY: z.string().min(1, 'JWT_REFRESH_KEY is required'),

  ACCESS_TTL_DAYS: z.string().min(1).default('15m'),
  REFRESH_TTL_DAYS: z.string().min(1).default('30d'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }
  return result.data;
}

export const getEnv = (): EnvConfig => envSchema.parse(process.env);
