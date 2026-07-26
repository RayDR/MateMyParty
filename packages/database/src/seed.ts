import 'dotenv/config';
import { createDatabase } from './client.js';
import { eventDomains, eventRevisions, events, guests, users } from './schema.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const ids = {
  owner: '11111111-1111-4111-8111-111111111111',
  event: '22222222-2222-4222-8222-222222222222',
  domain: '33333333-3333-4333-8333-333333333333',
  revision: '44444444-4444-4444-8444-444444444444',
} as const;

const event = {
  id: ids.event,
  ownerUserId: ids.owner,
  title: 'Raymundo’s 6th Birthday',
  celebrantName: 'Raymundo',
  celebrantAge: 6,
  eventType: 'KIDS_BIRTHDAY' as const,
  status: 'DRAFT' as const,
  startsAt: new Date('2026-08-06T18:00:00.000Z'),
  endsAt: null,
  timezone: 'America/Chicago',
  locale: 'en-US',
  venueName: 'Kids Empire Dallas Hillcrest',
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postalCode: null,
  countryCode: null,
  publicSlug: 'raymundo-6',
  templateKey: 'kids-night-dragon',
  templateVersion: 1,
  hostMessage: null,
  rsvpDeadline: null,
};

async function run(url: string) {
  const connection = createDatabase(url);
  try {
    await connection.db.transaction(async (tx) => {
      await tx
        .insert(users)
        .values({
          id: ids.owner,
          email: 'owner@matemyparty.local',
          displayName: 'MateMyParty Owner',
          locale: 'en-US',
        })
        .onConflictDoNothing();
      await tx.insert(events).values(event).onConflictDoNothing();
      await tx
        .insert(eventDomains)
        .values({
          id: ids.domain,
          eventId: ids.event,
          hostname: 'raymundo6th.domoforge.com',
          isPrimary: true,
        })
        .onConflictDoNothing();
      await tx
        .insert(eventRevisions)
        .values({
          id: ids.revision,
          eventId: ids.event,
          revisionNumber: 1,
          snapshot: { ...event, startsAt: event.startsAt.toISOString() },
          changeReason: 'Initial seed',
        })
        .onConflictDoNothing();
      if (process.env.SEED_SAMPLE_GUESTS === 'true') {
        await tx
          .insert(guests)
          .values([
            {
              id: '55555555-5555-4555-8555-555555555555',
              eventId: ids.event,
              displayName: 'Family Sample',
              preferredChannel: 'MANUAL',
              locale: 'en-US',
            },
            {
              id: '66666666-6666-4666-8666-666666666666',
              eventId: ids.event,
              displayName: 'Familia Ejemplo',
              preferredChannel: 'MANUAL',
              locale: 'es-MX',
            },
          ])
          .onConflictDoNothing();
      }
    });
    console.info('Initial owner, event, hostname, and revision seeded.');
  } finally {
    await connection.pool.end();
  }
}

void run(databaseUrl);
