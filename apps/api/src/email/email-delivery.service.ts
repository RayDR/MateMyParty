import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  emailDeliveryHistorySchema,
  emailPreviewSchema,
  eventEmailStatisticsSchema,
  guestEmailDeliverySchema,
  sendInvitationEmailInputSchema,
  sendInvitationEmailResultSchema,
  sendTestEmailInputSchema,
  sendTestEmailResultSchema,
  type EmailEligibility,
  type GuestEmailDelivery,
} from '@matemyparty/contracts';
import type { events, guests, invitations, DatabaseExecutor } from '@matemyparty/database';
import type { Locale } from '@matemyparty/i18n';
import { ApiError, parseInput } from '../common/api-error';
import { EventsRepository } from '../events/events.repository';
import { presentInvitation } from '../guests/guest.presenter';
import { InvitationsRepository } from '../invitations/invitations.repository';
import { InvitationsService } from '../invitations/invitations.service';
import { EmailDeliveryRepository } from './email-delivery.repository';
import { EMAIL_PROVIDER, type EmailProvider, type EmailProviderResult } from './email-provider';
import { presentEmailAttempt } from './email-presenter';
import { EMAIL_PREVIEW_URL, EMAIL_TEMPLATE_VERSION, renderInvitationEmail } from './email-renderer';
import { EmailConcurrencyGate, EmailRateLimiter } from './email-rate-limiter';

type GuestRow = typeof guests.$inferSelect;
type EventRow = typeof events.$inferSelect;
type InvitationRow = typeof invitations.$inferSelect;

@Injectable()
export class EmailDeliveryService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly repository: EmailDeliveryRepository,
    private readonly events: EventsRepository,
    private readonly invitationRepository: InvitationsRepository,
    private readonly invitations: InvitationsService,
    private readonly rateLimiter: EmailRateLimiter,
    private readonly gate: EmailConcurrencyGate,
  ) {}

  async guestSummary(
    guest: GuestRow,
    invitation: InvitationRow | null,
    event?: EventRow,
  ): Promise<GuestEmailDelivery> {
    const [lastAttempt, resolvedEvent] = await Promise.all([
      this.repository.latestForGuest(guest.id),
      event
        ? Promise.resolve(event)
        : this.events.findHostRecordById(guest.eventId).then((row) => row?.event),
    ]);
    const eligibility = emailEligibility(
      guest,
      invitation,
      resolvedEvent ?? null,
      this.provider.enabled(),
      false,
    );
    return guestEmailDeliverySchema.parse({
      eligibility,
      lastAttempt: lastAttempt ? presentEmailAttempt(lastAttempt) : null,
      retryAvailable: Boolean(lastAttempt?.retryable && eligibility.eligible),
    });
  }

  preview(guestId: string, requestedLocale?: string) {
    return this.repository.transaction(async (executor) => {
      const context = await this.context(guestId, executor);
      const locale = selectLocale(requestedLocale, context.guest.locale);
      const rendered = this.render(context, locale, EMAIL_PREVIEW_URL);
      return emailPreviewSchema.parse({ ...rendered, usesPlaceholderLink: true });
    });
  }

  async send(guestId: string, rawInput: unknown) {
    const input = parseInput(sendInvitationEmailInputSchema, rawInput);
    const prepared = await this.repository.transaction(async (executor) => {
      if (!(await this.repository.lockGuest(guestId, executor))) throw this.guestNotFound();
      const duplicate = await this.repository.byIdempotencyKey(input.idempotencyKey, executor);
      if (duplicate) {
        if (duplicate.guestId !== guestId) {
          throw new ApiError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key conflict');
        }
        const invitation = await this.invitationRepository.findById(
          duplicate.invitationId,
          executor,
        );
        if (!invitation) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
        return { duplicate, invitation, publicUrl: null, message: null, recipient: null };
      }
      this.rateLimiter.assertAllowed(guestId);
      const context = await this.context(guestId, executor);
      const pendingAttempt = await this.repository.latestForGuest(guestId, executor);
      if (pendingAttempt?.status === 'QUEUED' || pendingAttempt?.status === 'SENDING') {
        throw new ApiError(409, 'EMAIL_SEND_IN_PROGRESS', 'An email send is already in progress');
      }
      const active = await this.invitationRepository.findActiveByGuest(guestId, executor);
      const latest =
        active ?? (await this.invitationRepository.findLatestByGuest(guestId, executor));
      const eligibility = emailEligibility(
        context.guest,
        latest,
        context.event,
        this.provider.enabled(),
        input.overridePreferredChannel,
      );
      if (!eligibility.eligible) throw eligibilityError(eligibility);
      if (eligibility.requiresRegeneration && !input.regenerate) {
        throw eligibilityError({
          ...eligibility,
          reason: active ? 'TOKEN_REGENERATION_REQUIRED' : 'INVITATION_REVOKED',
        });
      }
      const generated = latest
        ? await this.invitations.regenerateInTransaction(latest.id, executor)
        : await this.invitations.createForGuestInTransaction(context.guest, executor, 'CREATED');
      const invitation = await this.invitationRepository.findById(
        generated.invitation.id,
        executor,
      );
      if (!invitation)
        throw new ApiError(500, 'EMAIL_PREPARATION_FAILED', 'Email preparation failed');
      const locale = selectLocale(invitation.locale, context.guest.locale);
      const rendered = this.render(context, locale, generated.publicUrl);
      const attempt = await this.repository.insert(
        {
          invitationId: invitation.id,
          guestId: context.guest.id,
          eventId: context.event.id,
          status: 'QUEUED',
          provider: this.provider.name,
          attemptNumber: await this.repository.nextAttemptNumber(context.guest.id, executor),
          recipientHash: recipientHash(context.guest.email!),
          locale,
          subjectSnapshot: rendered.subject,
          templateVersion: EMAIL_TEMPLATE_VERSION,
          idempotencyKey: input.idempotencyKey,
        },
        executor,
      );
      return {
        duplicate: attempt,
        invitation,
        publicUrl: generated.publicUrl,
        message: rendered,
        recipient: context.guest.email!,
      };
    });

    if (!prepared.message || !prepared.recipient) {
      return sendInvitationEmailResultSchema.parse({
        attempt: presentEmailAttempt(prepared.duplicate),
        invitation: presentInvitation(prepared.invitation),
        publicUrl: null,
        duplicate: true,
      });
    }
    const sending = await this.repository.markSending(prepared.duplicate.id);
    if (!sending)
      throw new ApiError(409, 'EMAIL_ATTEMPT_NOT_QUEUED', 'Email attempt is not queued');
    const providerResult = await this.safeProviderSend(prepared.recipient, prepared.message);
    const finalAttempt = providerResult.accepted
      ? await this.repository.markSent(sending.id, providerResult)
      : await this.repository.markFailed(sending.id, {
          providerStatus: providerResult.providerStatus,
          retryable: providerResult.retryable,
          safeErrorCode: providerResult.safeErrorCode ?? 'EMAIL_SEND_FAILED',
          safeErrorMessage:
            providerResult.safeErrorMessage ??
            'The email could not be accepted by the mail server.',
        });
    const invitation = providerResult.accepted
      ? await this.invitationRepository.markSent(prepared.invitation.id)
      : prepared.invitation;
    if (!invitation) throw new ApiError(500, 'EMAIL_STATUS_FAILED', 'Email status update failed');
    return sendInvitationEmailResultSchema.parse({
      attempt: presentEmailAttempt(finalAttempt),
      invitation: presentInvitation(invitation),
      publicUrl: prepared.publicUrl,
      duplicate: false,
    });
  }

  async history(guestId: string) {
    if (!(await this.repository.guestById(guestId))) throw this.guestNotFound();
    return emailDeliveryHistorySchema.parse(
      (await this.repository.historyForGuest(guestId)).map(presentEmailAttempt),
    );
  }

  async test(eventIdentifier: string, rawInput: unknown) {
    const input = parseInput(sendTestEmailInputSchema, rawInput);
    const record = await this.events.findHostRecordByIdentifier(eventIdentifier);
    if (!record) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
    if (!this.provider.enabled()) {
      throw new ApiError(503, 'EMAIL_NOT_CONFIGURED', 'Email delivery is not configured');
    }
    this.rateLimiter.assertAllowed(`test:${record.event.id}`);
    const locale = selectLocale(input.locale, record.event.locale);
    const rendered = renderInvitationEmail({
      event: record.event,
      localization: record.localizations.find((row) => row.locale === locale),
      locale,
      hostname: record.primaryHostname,
      invitationUrl: EMAIL_PREVIEW_URL,
      test: true,
    });
    const result = await this.safeProviderSend(input.email, rendered);
    return sendTestEmailResultSchema.parse({
      accepted: result.accepted,
      providerStatus: result.providerStatus,
      safeErrorCode: result.safeErrorCode,
      safeErrorMessage: result.safeErrorMessage,
    });
  }

  async statistics(eventIdentifier: string) {
    const record = await this.events.findHostRecordByIdentifier(eventIdentifier);
    if (!record) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
    const guestRows = await this.repository.guestsForEvent(record.event.id);
    const eligibility = await Promise.all(
      guestRows.map(async (guest) =>
        emailEligibility(
          guest,
          await this.invitationRepository.findActiveByGuest(guest.id),
          record.event,
          this.provider.enabled(),
          false,
        ),
      ),
    );
    const counts = Object.fromEntries(
      (await this.repository.statusCounts(record.event.id)).map((row) => [
        row.status.toLowerCase(),
        Number(row.value),
      ]),
    );
    return eventEmailStatisticsSchema.parse({
      eligibleGuests: eligibility.filter((row) => row.eligible).length,
      ineligibleGuests: eligibility.filter((row) => !row.eligible).length,
      queued: counts.queued ?? 0,
      sending: counts.sending ?? 0,
      sent: counts.sent ?? 0,
      delivered: counts.delivered ?? 0,
      failed: counts.failed ?? 0,
      cancelled: counts.cancelled ?? 0,
    });
  }

  private async context(guestId: string, executor: DatabaseExecutor) {
    const guest = await this.repository.guestById(guestId, executor);
    if (!guest) throw this.guestNotFound();
    const record = await this.events.findHostRecordById(guest.eventId, executor);
    if (!record) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
    return { guest, ...record };
  }

  private render(
    context: Awaited<ReturnType<EmailDeliveryService['context']>>,
    locale: Locale,
    invitationUrl: string,
  ) {
    try {
      return renderInvitationEmail({
        event: context.event,
        localization: context.localizations.find((row) => row.locale === locale),
        locale,
        hostname: context.primaryHostname,
        invitationUrl,
      });
    } catch {
      throw new ApiError(422, 'EMAIL_TEMPLATE_INVALID', 'Email template data is invalid');
    }
  }

  private async safeProviderSend(
    recipient: string,
    message: { subject: string; html: string; text: string },
  ): Promise<EmailProviderResult> {
    try {
      return await this.gate.run(async () => {
        return await this.provider.send({ to: recipient, ...message });
      });
    } catch {
      return {
        accepted: false,
        providerMessageId: null,
        providerStatus: 'FAILED',
        retryable: true,
        safeErrorCode: 'EMAIL_PROVIDER_FAILURE',
        safeErrorMessage: 'The email provider failed safely.',
      };
    }
  }

  private guestNotFound() {
    return new ApiError(404, 'GUEST_NOT_FOUND', 'Guest not found');
  }
}

export function emailEligibility(
  guest: GuestRow,
  invitation: InvitationRow | null,
  event: EventRow | null,
  providerEnabled: boolean,
  overridePreferredChannel: boolean,
): EmailEligibility {
  if (guest.archivedAt) return ineligible('GUEST_ARCHIVED');
  if (!guest.email) return ineligible('EMAIL_MISSING');
  if (
    !overridePreferredChannel &&
    guest.preferredChannel !== 'EMAIL' &&
    guest.preferredChannel !== 'BOTH'
  ) {
    return ineligible('CHANNEL_NOT_ALLOWED');
  }
  if (!event || event.status !== 'PUBLISHED') return ineligible('EVENT_NOT_SENDABLE');
  if (!providerEnabled) return ineligible('EMAIL_NOT_CONFIGURED');
  if (invitation) {
    return {
      eligible: true,
      action: 'REGENERATE_AND_SEND',
      reason: invitation.revokedAt ? 'INVITATION_REVOKED' : 'TOKEN_REGENERATION_REQUIRED',
      requiresRegeneration: true,
    };
  }
  return {
    eligible: true,
    action: 'GENERATE_AND_SEND',
    reason: 'ELIGIBLE',
    requiresRegeneration: false,
  };
}

function ineligible(reason: EmailEligibility['reason']): EmailEligibility {
  return { eligible: false, action: null, reason, requiresRegeneration: false };
}

function eligibilityError(eligibility: EmailEligibility): ApiError {
  const status = eligibility.reason === 'EMAIL_NOT_CONFIGURED' ? 503 : 409;
  const messages: Record<EmailEligibility['reason'], string> = {
    ELIGIBLE: 'Email is eligible',
    GUEST_ARCHIVED: 'Archived guests cannot receive email',
    EMAIL_MISSING: 'The guest does not have an email address',
    CHANNEL_NOT_ALLOWED: 'The preferred channel does not permit email',
    INVITATION_REVOKED: 'The revoked invitation must be regenerated before sending',
    TOKEN_REGENERATION_REQUIRED: 'Regeneration is required because the raw token is not stored',
    EVENT_NOT_SENDABLE: 'The event is not published for sending',
    EMAIL_NOT_CONFIGURED: 'Email delivery is not configured',
  };
  return new ApiError(status, eligibility.reason, messages[eligibility.reason]);
}

function recipientHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function selectLocale(requested: string | undefined, fallback: string): Locale {
  return requested === 'es-MX' || requested === 'en-US'
    ? requested
    : fallback === 'es-MX'
      ? 'es-MX'
      : 'en-US';
}
