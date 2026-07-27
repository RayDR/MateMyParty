import { randomUUID } from 'node:crypto';
import type { EmailProvider, EmailProviderResult } from './email-provider';

export class StubEmailProvider implements EmailProvider {
  readonly name = 'stub';
  enabled() {
    return true;
  }
  async send(): Promise<EmailProviderResult> {
    return {
      accepted: true,
      providerMessageId: `stub-${randomUUID()}`,
      providerStatus: 'ACCEPTED',
      retryable: false,
      safeErrorCode: null,
      safeErrorMessage: null,
    };
  }
}

export class DisabledEmailProvider implements EmailProvider {
  readonly name = 'disabled';
  enabled() {
    return false;
  }
  async send(): Promise<EmailProviderResult> {
    return {
      accepted: false,
      providerMessageId: null,
      providerStatus: 'NOT_CONFIGURED',
      retryable: false,
      safeErrorCode: 'EMAIL_NOT_CONFIGURED',
      safeErrorMessage: 'Email delivery is not configured.',
    };
  }
}
