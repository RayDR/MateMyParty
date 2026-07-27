import { Injectable, NotFoundException } from '@nestjs/common';
import {
  hostEventDetailSchema,
  hostEventSummarySchema,
  invitationSharePreviewSchema,
  normalizeHostname,
  normalizeSlug,
  updateHostEventInputSchema,
  type HostPresentationPreview,
  type HostEventDetail,
  type HostEventSummary,
  type InvitationSharePreview,
  type PublicEventLanding,
} from '@matemyparty/contracts';
import { getDictionary, type Locale } from '@matemyparty/i18n';
import { ApiError, parseInput } from '../common/api-error';
import { EventsRepository, type HostEventRecord } from './events.repository';
import { presentHostPresentationPreview, presentPublicLanding } from './presentation.presenter';

@Injectable()
export class EventsService {
  constructor(private readonly repository: EventsRepository) {}

  async byHostname(rawHostname: string): Promise<PublicEventLanding> {
    return this.toPublicLanding(
      await this.repository.findByHostname(normalizeHostname(rawHostname)),
    );
  }

  async bySlug(rawSlug: string): Promise<PublicEventLanding> {
    return this.toPublicLanding(await this.repository.findBySlug(normalizeSlug(rawSlug)));
  }

  async listHostEvents(): Promise<HostEventSummary[]> {
    return (await this.repository.listHostRecords()).map((record) => this.toHostSummary(record));
  }

  async hostEvent(identifier: string): Promise<HostEventDetail> {
    const record = await this.repository.findHostRecordByIdentifier(identifier);
    if (!record) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
    return this.toHostDetail(record);
  }

  async invitationSharePreview(
    identifier: string,
    requestedLocale?: string,
  ): Promise<InvitationSharePreview> {
    const event = await this.hostEvent(identifier);
    const locale: Locale =
      requestedLocale === 'en-US' || requestedLocale === 'es-MX'
        ? requestedLocale
        : event.defaultLocale;
    const content = event.localizedContent[locale];
    const dictionary = getDictionary(locale).invitation;
    const invitationText = dictionary.shareGeneric.replace('{eventTitle}', content.title);
    const invitationUrl = event.primaryHostname ? `https://${event.primaryHostname}/i/…` : '/i/…';
    return invitationSharePreviewSchema.parse({
      eventTitle: content.title,
      invitationText,
      smsText: dictionary.shareSms
        .replace('{eventTitle}', content.title)
        .replace('{invitationUrl}', invitationUrl),
      hostname: event.primaryHostname,
      thumbnailImageRef: event.thumbnailImageRef,
      thumbnailAltText: content.thumbnailAltText,
      locale,
    });
  }

  async presentationPreview(
    identifier: string,
    requestedLocale?: string,
  ): Promise<HostPresentationPreview> {
    const record = await this.repository.findHostRecordByIdentifier(identifier);
    if (!record) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
    const defaultLocale: Locale = record.event.locale === 'es-MX' ? 'es-MX' : 'en-US';
    const locale: Locale =
      requestedLocale === 'en-US' || requestedLocale === 'es-MX' ? requestedLocale : defaultLocale;
    return presentHostPresentationPreview(record, locale);
  }

  async updateHostEvent(identifier: string, rawInput: unknown): Promise<HostEventDetail> {
    const input = parseInput(updateHostEventInputSchema, rawInput);
    return this.repository.transaction(async (executor) => {
      const eventId = await this.repository.findInternalIdByIdentifier(identifier, executor);
      if (!eventId || !(await this.repository.lockById(eventId, executor))) {
        throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
      }
      if (!(await this.repository.updateEvent(eventId, input, executor))) {
        throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
      }
      await this.repository.upsertLocalizations(eventId, input.localizedContent, executor);
      const updated = await this.repository.findHostRecordById(eventId, executor);
      if (!updated) throw new ApiError(404, 'EVENT_NOT_FOUND', 'Event not found');
      const revisionNumber = updated.revisionNumber + 1;
      const detail = this.toHostDetail({ ...updated, revisionNumber });
      await this.repository.insertRevision(
        eventId,
        revisionNumber,
        this.revisionSnapshot(detail),
        executor,
      );
      return detail;
    });
  }

  private toPublicLanding(
    row: Awaited<ReturnType<EventsRepository['findBySlug']>>,
  ): PublicEventLanding {
    if (!row) throw new NotFoundException('Event not found');
    return presentPublicLanding(row);
  }

  private toHostSummary(record: HostEventRecord): HostEventSummary {
    const event = record.event;
    const content = this.localizedContent(record);
    const canonical = content[event.locale === 'es-MX' ? 'es-MX' : 'en-US'];
    return hostEventSummarySchema.parse({
      identifier: event.publicSlug || event.publicCode,
      publicSlug: event.publicSlug,
      publicCode: event.publicCode,
      title: canonical.title,
      celebrantName: canonical.celebrantName,
      celebrantAge: event.celebrantAge,
      startsAt: event.startsAt.toISOString(),
      venueName: canonical.venueName,
      status: event.status,
      templateKey: event.templateKey,
      primaryHostname: record.primaryHostname,
      thumbnailImageRef: event.thumbnailImageRef,
      statistics: {
        ...record.statistics,
      },
    });
  }

  private toHostDetail(record: HostEventRecord): HostEventDetail {
    const event = record.event;
    return hostEventDetailSchema.parse({
      ...this.toHostSummary(record),
      eventType: event.eventType,
      endsAt: event.endsAt?.toISOString() ?? null,
      timezone: event.timezone,
      defaultLocale: event.locale,
      addressLine1: event.addressLine1,
      addressLine2: event.addressLine2,
      city: event.city,
      region: event.region,
      postalCode: event.postalCode,
      countryCode: event.countryCode,
      mapsUrl: event.mapsUrl,
      staticBackgroundRef: event.staticBackgroundRef,
      localizedContent: this.localizedContent(record),
      template: {
        key: event.templateKey,
        version: event.templateVersion,
        animationMode: event.animationMode,
        videoBackgroundRef: event.videoBackgroundRef,
        staticFallbackRef: event.staticFallbackRef,
        audioRef: event.audioRef,
        animationEnabled: event.animationEnabled,
        audioEnabled: event.audioEnabled,
        overlayIntensity: event.overlayIntensity,
      },
      revisionNumber: record.revisionNumber,
    });
  }

  private localizedContent(record: HostEventRecord) {
    const fallback = {
      title: record.event.title,
      celebrantName: record.event.celebrantName,
      venueName: record.event.venueName,
      hostMessage: record.event.hostMessage,
      arrivalInstructions: null,
      thumbnailAltText: record.event.title,
    };
    const locale = (value: 'en-US' | 'es-MX') => {
      const row = record.localizations.find((candidate) => candidate.locale === value);
      return row
        ? {
            title: row.title,
            celebrantName: row.celebrantName,
            venueName: row.venueName,
            hostMessage: row.hostMessage,
            arrivalInstructions: row.arrivalInstructions,
            thumbnailAltText: row.thumbnailAltText,
          }
        : fallback;
    };
    return { 'en-US': locale('en-US'), 'es-MX': locale('es-MX') };
  }

  private revisionSnapshot(detail: HostEventDetail): Record<string, unknown> {
    return {
      publicSlug: detail.publicSlug,
      publicCode: detail.publicCode,
      eventType: detail.eventType,
      status: detail.status,
      celebrantAge: detail.celebrantAge,
      startsAt: detail.startsAt,
      endsAt: detail.endsAt,
      timezone: detail.timezone,
      defaultLocale: detail.defaultLocale,
      addressLine1: detail.addressLine1,
      addressLine2: detail.addressLine2,
      city: detail.city,
      region: detail.region,
      postalCode: detail.postalCode,
      countryCode: detail.countryCode,
      mapsUrl: detail.mapsUrl,
      thumbnailImageRef: detail.thumbnailImageRef,
      staticBackgroundRef: detail.staticBackgroundRef,
      localizedContent: detail.localizedContent,
      template: detail.template,
    };
  }
}
