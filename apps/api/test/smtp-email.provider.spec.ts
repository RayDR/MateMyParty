import nodemailer from 'nodemailer';
import { environmentSchema } from '@matemyparty/config';
import { SmtpEmailProvider } from '../src/email/smtp-email.provider';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

const createTransport = nodemailer.createTransport as jest.Mock;
const environment = environmentSchema.parse({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
  EMAIL_PROVIDER: 'smtp',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: 587,
  SMTP_SECURE: 'false',
  SMTP_USERNAME: 'mailer',
  SMTP_PASSWORD: 'provider-secret',
  EMAIL_FROM_ADDRESS: 'invitations@example.test',
  EMAIL_FROM_NAME: 'MateMyParty',
});

const message = {
  to: 'guest@example.test',
  subject: 'Invitation: Birthday',
  html: '<p>Invitation</p>',
  text: 'Invitation',
};

describe('SmtpEmailProvider', () => {
  afterEach(() => jest.clearAllMocks());

  it('requires transport TLS and disables debug plus external attachment loading', () => {
    createTransport.mockReturnValue({ sendMail: jest.fn() });
    new SmtpEmailProvider(environment);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        secure: false,
        requireTLS: true,
        disableFileAccess: true,
        disableUrlAccess: true,
        logger: false,
        debug: false,
      }),
    );
  });

  it('maps provider failures to bounded safe categories without returning raw diagnostics', async () => {
    const providerFailure = Object.assign(
      new Error('authentication failed provider-secret guest@example.test'),
      { code: 'EAUTH' },
    );
    createTransport.mockReturnValue({ sendMail: jest.fn().mockRejectedValue(providerFailure) });
    const result = await new SmtpEmailProvider(environment).send(message);
    expect(result).toMatchObject({
      accepted: false,
      retryable: false,
      safeErrorCode: 'SMTP_AUTHENTICATION_FAILED',
    });
    expect(JSON.stringify(result)).not.toContain('provider-secret');
    expect(JSON.stringify(result)).not.toContain('guest@example.test');
  });

  it('uses SENT semantics only after complete provider acceptance', async () => {
    createTransport.mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({
        accepted: ['guest@example.test'],
        rejected: [],
        messageId: 'provider-message-id',
      }),
    });
    await expect(new SmtpEmailProvider(environment).send(message)).resolves.toMatchObject({
      accepted: true,
      providerStatus: 'ACCEPTED',
      retryable: false,
    });
  });
});
