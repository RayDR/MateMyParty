import { describe, expect, it } from 'vitest';
import { environmentSchema } from './index.js';

const base = { DATABASE_URL: 'postgresql://user:password@localhost:5432/app' };

describe('email environment configuration', () => {
  it('uses the non-delivering stub outside production', () => {
    expect(
      environmentSchema.parse({ ...base, EMAIL_FROM_ADDRESS: '', EMAIL_REPLY_TO: '' }),
    ).toMatchObject({ EMAIL_PROVIDER: 'stub', EMAIL_FROM_ADDRESS: undefined });
  });

  it('requires an explicitly configured SMTP provider in production', () => {
    expect(() => environmentSchema.parse({ ...base, NODE_ENV: 'production' })).toThrow();
    expect(() =>
      environmentSchema.parse({ ...base, NODE_ENV: 'production', EMAIL_PROVIDER: 'smtp' }),
    ).toThrow();
  });

  it('accepts bounded SMTP production configuration without exposing its password', () => {
    const environment = environmentSchema.parse({
      ...base,
      NODE_ENV: 'production',
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.example.test',
      SMTP_USERNAME: 'mailer',
      SMTP_PASSWORD: 'secret-value',
      EMAIL_FROM_ADDRESS: 'invitations@example.test',
    });
    expect(environment.EMAIL_PROVIDER).toBe('smtp');
  });
});
