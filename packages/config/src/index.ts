import { z } from 'zod';

const optionalEmail = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().email().max(254).optional(),
);

export const environmentSchema = z
  .object({
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
    PUBLIC_APP_HOSTNAMES: z.string().default('matemyparty.domoforge.com,raymundo6th.domoforge.com'),
    HOST_ADMIN_TOKEN: z.string().optional(),
    PUBLIC_APP_PROTOCOL: z.enum(['http', 'https']).default('http'),
    SEED_SAMPLE_GUESTS: z.enum(['true', 'false']).default('false'),
    EMAIL_PROVIDER: z.enum(['disabled', 'stub', 'smtp']).default('stub'),
    SMTP_HOST: z.string().trim().max(253).optional(),
    SMTP_PORT: z.coerce.number().int().positive().max(65_535).default(587),
    SMTP_SECURE: z.enum(['true', 'false']).default('false'),
    SMTP_USERNAME: z.string().max(320).optional(),
    SMTP_PASSWORD: z.string().max(1000).optional(),
    EMAIL_FROM_ADDRESS: optionalEmail,
    EMAIL_FROM_NAME: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[^\r\n]+$/)
      .default('MateMyParty'),
    EMAIL_REPLY_TO: optionalEmail,
    EMAIL_SEND_CONCURRENCY: z.coerce.number().int().positive().max(10).default(2),
    EMAIL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().max(100).default(10),
    EMAIL_SEND_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(15_000),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.EMAIL_PROVIDER !== 'smtp') {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVIDER'],
        message: 'Production requires EMAIL_PROVIDER=smtp',
      });
    }
    if (value.EMAIL_PROVIDER === 'smtp') {
      for (const key of [
        'SMTP_HOST',
        'SMTP_USERNAME',
        'SMTP_PASSWORD',
        'EMAIL_FROM_ADDRESS',
      ] as const) {
        if (!value[key]) {
          context.addIssue({ code: 'custom', path: [key], message: `${key} is required for SMTP` });
        }
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
  return environmentSchema.parse(input);
}
