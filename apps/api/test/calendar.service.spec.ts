import type { FastifyReply } from 'fastify';
import type { DatabaseExecutor } from '@matemyparty/database';
import { ApiError } from '../src/common/api-error';
import { PublicCalendarController } from '../src/calendar/calendar.controller';
import { CalendarService } from '../src/calendar/calendar.service';
import type { EventsRepository } from '../src/events/events.repository';
import type { InvitationsRepository } from '../src/invitations/invitations.repository';
import type { InvitationsService } from '../src/invitations/invitations.service';

describe('private calendar access', () => {
  it('returns a neutral not-found error when invitation access is revoked', async () => {
    const invitationRepository = {
      transaction: (operation: (executor: DatabaseExecutor) => Promise<unknown>) =>
        operation({} as DatabaseExecutor),
    } as InvitationsRepository;
    const invitations = {
      resolveAccess: jest
        .fn()
        .mockRejectedValue(new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found')),
    } as unknown as InvitationsService;
    const service = new CalendarService(invitations, invitationRepository, {} as EventsRepository);
    await expect(service.privateIcs({ permanentToken: 'revoked' })).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'INVITATION_NOT_FOUND' }),
    });
  });

  it('sets the standards-compliant ICS download headers', async () => {
    const service = {
      privateIcs: jest.fn().mockResolvedValue({
        body: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
        filename: 'matemyparty-raymundo-6.ics',
      }),
    } as unknown as CalendarService;
    const headers = new Map<string, string>();
    const response = {
      header: (name: string, value: string) => {
        headers.set(name, value);
        return response;
      },
    } as unknown as FastifyReply;
    const body = await new PublicCalendarController(service).ics(
      response,
      'valid-token',
      undefined,
      'es-MX',
    );
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(headers.get('content-disposition')).toBe(
      'attachment; filename="matemyparty-raymundo-6.ics"',
    );
    expect(service.privateIcs).toHaveBeenCalledWith(
      { permanentToken: 'valid-token', grantToken: undefined },
      'es-MX',
    );
  });

  it('builds the protected host preview without resolving or opening an invitation', async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const resolveAccess = jest.fn();
    const recordOpen = jest.fn();
    const record = {
      event: {
        title: 'Raymundo’s 6th Birthday',
        publicSlug: 'raymundo-6',
        publicCode: 'SQ52LQE9',
        startsAt: new Date('2026-08-06T18:00:00.000Z'),
        endsAt: null,
        updatedAt: new Date('2026-07-26T00:00:00.000Z'),
        timezone: 'America/Chicago',
        locale: 'en-US',
        venueName: 'Celebration Center',
        addressLine1: '123 Celebration Lane',
        addressLine2: null,
        city: 'Dallas',
        region: 'Texas',
        postalCode: '75201',
        countryCode: 'US',
        latitude: null,
        longitude: null,
        mapsUrl: null,
        hostMessage: null,
      },
      localizations: [],
      primaryHostname: 'raymundo6th.domoforge.com',
    };
    const service = new CalendarService(
      { resolveAccess } as unknown as InvitationsService,
      { recordOpen } as unknown as InvitationsRepository,
      {
        findHostRecordByIdentifier: jest.fn().mockResolvedValue(record),
      } as unknown as EventsRepository,
    );
    const preview = await service.hostPreview('raymundo-6', 'en-US');
    expect(preview.stableUid).toBe('SQ52LQE9@calendar.matemyparty.domoforge.com');
    expect(preview.providerFallbackMinutes).toBe(120);
    expect(preview.maps?.googleMapsUrl).toContain('google.com/maps');
    expect(preview.event.invitationUrl).toBe('https://raymundo6th.domoforge.com/');
    expect(preview.event.googleCalendarUrl).toContain(
      encodeURIComponent('https://raymundo6th.domoforge.com/'),
    );
    expect(resolveAccess).not.toHaveBeenCalled();
    expect(recordOpen).not.toHaveBeenCalled();
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  });
});
