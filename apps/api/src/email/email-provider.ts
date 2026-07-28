export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export type EmailProviderMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailProviderResult = {
  accepted: boolean;
  providerMessageId: string | null;
  providerStatus: string;
  retryable: boolean;
  safeErrorCode: string | null;
  safeErrorMessage: string | null;
};

export interface EmailProvider {
  readonly name: string;
  enabled(): boolean;
  send(message: EmailProviderMessage): Promise<EmailProviderResult>;
}
