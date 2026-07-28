import nodemailer from 'nodemailer';
import type { Environment } from '@matemyparty/config';
import type { EmailProvider, EmailProviderMessage, EmailProviderResult } from './email-provider';

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly transport;

  constructor(private readonly environment: Environment) {
    this.transport = nodemailer.createTransport({
      host: environment.SMTP_HOST,
      port: environment.SMTP_PORT,
      secure: environment.SMTP_SECURE === 'true',
      requireTLS: environment.SMTP_SECURE !== 'true',
      auth:
        environment.SMTP_USERNAME && environment.SMTP_PASSWORD
          ? { user: environment.SMTP_USERNAME, pass: environment.SMTP_PASSWORD }
          : undefined,
      connectionTimeout: environment.EMAIL_SEND_TIMEOUT_MS,
      greetingTimeout: environment.EMAIL_SEND_TIMEOUT_MS,
      socketTimeout: environment.EMAIL_SEND_TIMEOUT_MS,
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false,
    });
  }

  enabled(): boolean {
    return Boolean(
      this.environment.SMTP_HOST &&
        this.environment.SMTP_USERNAME &&
        this.environment.SMTP_PASSWORD &&
        this.environment.EMAIL_FROM_ADDRESS,
    );
  }

  async send(message: EmailProviderMessage): Promise<EmailProviderResult> {
    if (!this.enabled()) return configurationFailure();
    try {
      const result = await this.transport.sendMail({
        from: {
          name: this.environment.EMAIL_FROM_NAME,
          address: this.environment.EMAIL_FROM_ADDRESS!,
        },
        replyTo: this.environment.EMAIL_REPLY_TO,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      const accepted = result.accepted.length > 0 && result.rejected.length === 0;
      return accepted
        ? {
            accepted: true,
            providerMessageId: bounded(result.messageId, 500),
            providerStatus: 'ACCEPTED',
            retryable: false,
            safeErrorCode: null,
            safeErrorMessage: null,
          }
        : {
            accepted: false,
            providerMessageId: bounded(result.messageId, 500),
            providerStatus: 'REJECTED',
            retryable: false,
            safeErrorCode: 'RECIPIENT_REJECTED',
            safeErrorMessage: 'The mail server rejected the message.',
          };
    } catch (error) {
      return sanitizedSmtpFailure(error);
    }
  }
}

function configurationFailure(): EmailProviderResult {
  return {
    accepted: false,
    providerMessageId: null,
    providerStatus: 'NOT_CONFIGURED',
    retryable: false,
    safeErrorCode: 'EMAIL_NOT_CONFIGURED',
    safeErrorMessage: 'Email delivery is not configured.',
  };
}

function sanitizedSmtpFailure(error: unknown): EmailProviderResult {
  const code =
    typeof error === 'object' && error && 'code' in error ? String(error.code).toUpperCase() : '';
  if (['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'EAI_AGAIN', 'ESOCKET'].includes(code)) {
    return failure('SMTP_TEMPORARY_FAILURE', 'The mail server is temporarily unavailable.', true);
  }
  if (['EAUTH', 'ENOAUTH'].includes(code)) {
    return failure('SMTP_AUTHENTICATION_FAILED', 'Email provider authentication failed.', false);
  }
  if (code === 'EENVELOPE') {
    return failure('RECIPIENT_REJECTED', 'The mail server rejected the recipient.', false);
  }
  return failure('SMTP_SEND_FAILED', 'The email could not be accepted by the mail server.', true);
}

function failure(code: string, message: string, retryable: boolean): EmailProviderResult {
  return {
    accepted: false,
    providerMessageId: null,
    providerStatus: 'FAILED',
    retryable,
    safeErrorCode: code,
    safeErrorMessage: message,
  };
}

function bounded(value: string | undefined, maximum: number): string | null {
  return value ? value.replace(/[\r\n]/g, '').slice(0, maximum) : null;
}
