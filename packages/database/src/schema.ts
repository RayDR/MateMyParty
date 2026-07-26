import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const eventStatus = pgEnum('event_status', [
  'DRAFT',
  'PUBLISHED',
  'CANCELLED',
  'COMPLETED',
  'ARCHIVED',
]);
export const eventType = pgEnum('event_type', ['KIDS_BIRTHDAY']);
export const preferredChannel = pgEnum('preferred_channel', ['EMAIL', 'SMS', 'BOTH', 'MANUAL']);
export const invitationStatus = pgEnum('invitation_status', [
  'DRAFT',
  'READY',
  'SENT',
  'OPENED',
  'REVOKED',
]);
export const invitationActivityType = pgEnum('invitation_activity_type', [
  'CREATED',
  'OPENED',
  'REVOKED',
  'REGENERATED',
]);

const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    locale: text('locale').notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex('users_email_normalized_unique').on(sql`lower(${table.email})`)],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    celebrantName: text('celebrant_name').notNull(),
    celebrantAge: integer('celebrant_age'),
    eventType: eventType('event_type').notNull(),
    status: eventStatus('status').notNull().default('DRAFT'),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }),
    timezone: text('timezone').notNull(),
    locale: text('locale').notNull(),
    venueName: text('venue_name'),
    addressLine1: text('address_line_1'),
    addressLine2: text('address_line_2'),
    city: text('city'),
    region: text('region'),
    postalCode: text('postal_code'),
    countryCode: text('country_code'),
    publicSlug: text('public_slug').notNull(),
    templateKey: text('template_key').notNull(),
    templateVersion: integer('template_version').notNull(),
    hostMessage: text('host_message'),
    rsvpDeadline: timestamp('rsvp_deadline', { withTimezone: true, mode: 'date' }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('events_public_slug_normalized_unique').on(sql`lower(${table.publicSlug})`),
  ],
);

export const eventDomains = pgTable(
  'event_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    hostname: text('hostname').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('event_domains_hostname_normalized_unique').on(sql`lower(${table.hostname})`),
    index('event_domains_event_id_index').on(table.eventId),
  ],
);

export const eventRevisions = pgTable(
  'event_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    revisionNumber: integer('revision_number').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    changeReason: text('change_reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('event_revisions_event_revision_unique').on(table.eventId, table.revisionNumber),
    index('event_revisions_event_id_index').on(table.eventId),
  ],
);

export const guests = pgTable(
  'guests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    displayName: text('display_name').notNull(),
    contactName: text('contact_name'),
    email: text('email'),
    phone: text('phone'),
    preferredChannel: preferredChannel('preferred_channel').notNull(),
    locale: text('locale').notNull(),
    adultsPlanned: integer('adults_planned'),
    childrenPlanned: integer('children_planned'),
    privateNotes: text('private_notes'),
    ...auditColumns,
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('guests_event_id_index').on(table.eventId),
    check(
      'guests_adults_planned_non_negative',
      sql`${table.adultsPlanned} is null or ${table.adultsPlanned} >= 0`,
    ),
    check(
      'guests_children_planned_non_negative',
      sql`${table.childrenPlanned} is null or ${table.childrenPlanned} >= 0`,
    ),
    check(
      'guests_preferred_channel_contact_check',
      sql`(${table.preferredChannel} = 'EMAIL' and ${table.email} is not null) or
          (${table.preferredChannel} = 'SMS' and ${table.phone} is not null) or
          (${table.preferredChannel} = 'BOTH' and ${table.email} is not null and ${table.phone} is not null) or
          (${table.preferredChannel} = 'MANUAL' and ${table.email} is null and ${table.phone} is null)`,
    ),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    guestId: uuid('guest_id')
      .notNull()
      .references(() => guests.id),
    publicTokenHash: text('public_token_hash').notNull(),
    publicTokenPrefix: text('public_token_prefix').notNull(),
    status: invitationStatus('status').notNull().default('READY'),
    locale: text('locale').notNull(),
    firstOpenedAt: timestamp('first_opened_at', { withTimezone: true, mode: 'date' }),
    lastOpenedAt: timestamp('last_opened_at', { withTimezone: true, mode: 'date' }),
    openCount: integer('open_count').notNull().default(0),
    ...auditColumns,
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('invitations_public_token_hash_unique').on(table.publicTokenHash),
    index('invitations_public_token_prefix_index').on(table.publicTokenPrefix),
    index('invitations_event_id_index').on(table.eventId),
    uniqueIndex('invitations_one_active_per_guest_unique')
      .on(table.guestId)
      .where(sql`${table.revokedAt} is null`),
    check('invitations_open_count_non_negative', sql`${table.openCount} >= 0`),
    check(
      'invitations_revoked_state_check',
      sql`(${table.status} = 'REVOKED' and ${table.revokedAt} is not null) or (${table.status} <> 'REVOKED' and ${table.revokedAt} is null)`,
    ),
  ],
);

export const invitationActivities = pgTable(
  'invitation_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id),
    type: invitationActivityType('type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    metadata: jsonb('metadata'),
  },
  (table) => [index('invitation_activities_invitation_id_index').on(table.invitationId)],
);
