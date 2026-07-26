import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WEB_HOST: z.string().default('0.0.0.0'),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  INTERNAL_API_BASE_URL: z.string().url().default('http://localhost:3001'),
  APP_VERSION: z.string().default('0.1.0'),
  DEFAULT_LOCALE: z.enum(['en-US', 'es-MX']).default('en-US'),
  SUPPORTED_LOCALES: z.string().default('en-US,es-MX'),
  PRIMARY_APP_HOSTNAME: z.string().default('matemyparty.domoforge.com'),
  HOST_ADMIN_TOKEN: z.string().optional(),
  PUBLIC_APP_PROTOCOL: z.enum(['http', 'https']).default('http'),
  SEED_SAMPLE_GUESTS: z.enum(['true', 'false']).default('false'),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
  return environmentSchema.parse(input);
}
