import { Injectable } from '@nestjs/common';
import type { Locale } from '@matemyparty/i18n';
import { ApiError } from '../common/api-error';
import {
  buildCalendarEvent,
  buildHostCalendarPreview,
  calendarFilename,
  createIcs,
} from '../events/event-tools';
import { EventsRepository } from '../events/events.repository';
import { InvitationsRepository } from '../invitations/invitations.repository';
import { InvitationsService } from '../invitations/invitations.service';

type Credentials = { permanentToken?: string; grantToken?: string };

@Injectable()
export class CalendarService {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly invitationRepository: InvitationsRepository,
    private readonly events: EventsRepository,
  ) {}

  privateEvent(credentials: Credentials, requestedLocale?: string) {
    return this.invitationRepository.transaction(async (executor) => {
      const invitation = await this.invitations.resolveAccess(
        credentials.permanentToken,
        credentials.grantToken,
        executor,
      );
      const details = await this.invitationRepository.publicDetails(invitation.id, executor);
      if (!details) throw this.notFound();
      const locale = selectLocale(requestedLocale, invitation.locale);
      return buildCalendarEvent(
        details.event,
        details.localizations.find((row) => row.locale === locale),
        locale,
        invitationUrl(details.primaryHostname),
      );
    });
  }

  privateIcs(credentials: Credentials, requestedLocale?: string) {
    return this.invitationRepository.transaction(async (executor) => {
      const invitation = await this.invitations.resolveAccess(
        credentials.permanentToken,
        credentials.grantToken,
        executor,
      );
      const details = await this.invitationRepository.publicDetails(invitation.id, executor);
      if (!details) throw this.notFound();
      const locale = selectLocale(requestedLocale, invitation.locale);
      return {
        body: createIcs(
          details.event,
          details.localizations.find((row) => row.locale === locale),
          invitationUrl(details.primaryHostname),
        ),
        filename: calendarFilename(details.event.publicSlug),
      };
    });
  }

  async hostPreview(identifier: string, requestedLocale?: string) {
    const record = await this.events.findHostRecordByIdentifier(identifier);
    if (!record) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
    const locale =
      requestedLocale === 'es-MX' || requestedLocale === 'en-US'
        ? requestedLocale
        : normalizeLocale(record.event.locale);
    return buildHostCalendarPreview(
      record.event,
      record.localizations.find((row) => row.locale === locale),
      locale,
      invitationUrl(record.primaryHostname),
    );
  }

  async hostIcs(identifier: string, requestedLocale?: string) {
    const record = await this.events.findHostRecordByIdentifier(identifier);
    if (!record) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
    const locale =
      requestedLocale === 'es-MX' || requestedLocale === 'en-US'
        ? requestedLocale
        : normalizeLocale(record.event.locale);
    return {
      body: createIcs(
        record.event,
        record.localizations.find((row) => row.locale === locale),
        invitationUrl(record.primaryHostname),
      ),
      filename: calendarFilename(record.event.publicSlug),
    };
  }

  private notFound() {
    return new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
  }
}

function invitationUrl(hostname: string | null): string {
  const protocol =
    process.env.PUBLIC_APP_PROTOCOL ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host = hostname ?? process.env.PRIMARY_APP_HOSTNAME ?? 'localhost:3000';
  return `${protocol}://${host}/`;
}

function normalizeLocale(value: string): Locale {
  return value === 'es-MX' ? 'es-MX' : 'en-US';
}

function selectLocale(requested: string | undefined, fallback: string): Locale {
  return requested === 'en-US' || requested === 'es-MX' ? requested : normalizeLocale(fallback);
}
