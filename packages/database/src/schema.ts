import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
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
export const eventAnimationMode = pgEnum('event_animation_mode', ['NONE', 'SUBTLE', 'IMMERSIVE']);
export const preferredChannel = pgEnum('preferred_channel', ['EMAIL', 'SMS', 'BOTH', 'MANUAL']);
export const invitationCountMode = pgEnum('invitation_count_mode', [
  'TOTAL_ONLY',
  'ADULTS_AND_CHILDREN',
]);
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
export const invitationLookupMethod = pgEnum('invitation_lookup_method', ['EMAIL', 'PHONE']);
export const emailDeliveryChannel = pgEnum('email_delivery_channel', ['EMAIL']);
export const emailDeliveryStatus = pgEnum('email_delivery_status', [
  'QUEUED',
  'SENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
]);
export const rsvpStatus = pgEnum('rsvp_status', ['ACCEPTED', 'DECLINED', 'NOT_SURE', 'CANCELLED']);
export const rsvpChangeSource = pgEnum('rsvp_change_source', ['INVITEE', 'HOST']);

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
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    publicSlug: text('public_slug').notNull(),
    publicCode: text('public_code').notNull(),
    templateKey: text('template_key').notNull(),
    templateVersion: integer('template_version').notNull(),
    animationMode: eventAnimationMode('animation_mode').notNull().default('NONE'),
    videoBackgroundRef: text('video_background_ref'),
    staticFallbackRef: text('static_fallback_ref'),
    audioRef: text('audio_ref'),
    animationEnabled: boolean('animation_enabled').notNull().default(false),
    audioEnabled: boolean('audio_enabled').notNull().default(false),
    overlayIntensity: integer('overlay_intensity').notNull().default(50),
    thumbnailImageRef: text('thumbnail_image_ref'),
    publicThumbnailRef: text('public_thumbnail_ref'),
    staticBackgroundRef: text('static_background_ref'),
    mapsUrl: text('maps_url'),
    hostMessage: text('host_message'),
    rsvpDeadline: timestamp('rsvp_deadline', { withTimezone: true, mode: 'date' }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('events_public_slug_normalized_unique').on(sql`lower(${table.publicSlug})`),
    uniqueIndex('events_public_code_unique').on(table.publicCode),
    check('events_public_code_format_check', sql`${table.publicCode} ~ '^[A-HJ-NP-Z2-9]{8,10}$'`),
    check(
      'events_template_key_check',
      sql`${table.templateKey} in ('kids-night-dragon', 'envelope-reveal', 'winter-snow', 'adventure-gates')`,
    ),
    check('events_overlay_intensity_check', sql`${table.overlayIntensity} between 0 and 100`),
    check(
      'events_end_after_start_check',
      sql`${table.endsAt} is null or ${table.endsAt} > ${table.startsAt}`,
    ),
    check(
      'events_coordinates_pair_check',
      sql`(${table.latitude} is null and ${table.longitude} is null) or (${table.latitude} is not null and ${table.longitude} is not null)`,
    ),
    check(
      'events_latitude_range_check',
      sql`${table.latitude} is null or ${table.latitude} between -90 and 90`,
    ),
    check(
      'events_longitude_range_check',
      sql`${table.longitude} is null or ${table.longitude} between -180 and 180`,
    ),
    check(
      'events_maps_url_scheme_check',
      sql`${table.mapsUrl} is null or ${table.mapsUrl} ~ '^https?://'`,
    ),
    check(
      'events_public_thumbnail_ref_check',
      sql`${table.publicThumbnailRef} is null or ${table.publicThumbnailRef} ~* '^(https://|/event-thumbnails/[a-z0-9-]+/[A-Za-z0-9._/-]+[.](avif|gif|jpe?g|png|webp)$)'`,
    ),
  ],
);

export const eventLocalizations = pgTable(
  'event_localizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    title: text('title').notNull(),
    celebrantName: text('celebrant_name').notNull(),
    venueName: text('venue_name'),
    hostMessage: text('host_message'),
    arrivalInstructions: text('arrival_instructions'),
    parkingInstructions: text('parking_instructions'),
    thumbnailAltText: text('thumbnail_alt_text').notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('event_localizations_event_locale_unique').on(table.eventId, table.locale),
    index('event_localizations_event_id_index').on(table.eventId),
    check('event_localizations_locale_check', sql`${table.locale} in ('en-US', 'es-MX')`),
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
    invitationCountMode: invitationCountMode('invitation_count_mode')
      .notNull()
      .default('TOTAL_ONLY'),
    totalInvited: integer('total_invited').notNull().default(0),
    adultsInvited: integer('adults_invited'),
    childrenInvited: integer('children_invited'),
    privateNotes: text('private_notes'),
    ...auditColumns,
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('guests_event_id_index').on(table.eventId),
    check(
      'guests_invitation_count_consistency',
      sql`(${table.invitationCountMode} = 'TOTAL_ONLY' and ${table.totalInvited} >= 0 and ${table.adultsInvited} is null and ${table.childrenInvited} is null) or
          (${table.invitationCountMode} = 'ADULTS_AND_CHILDREN' and ${table.adultsInvited} is not null and ${table.adultsInvited} >= 0 and ${table.childrenInvited} is not null and ${table.childrenInvited} >= 0 and ${table.totalInvited} = ${table.adultsInvited} + ${table.childrenInvited})`,
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

export const invitationAccessGrants = pgTable(
  'invitation_access_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    grantTokenHash: text('grant_token_hash').notNull(),
    grantTokenPrefix: text('grant_token_prefix').notNull(),
    lookupMethod: invitationLookupMethod('lookup_method').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('invitation_access_grants_token_hash_unique').on(table.grantTokenHash),
    index('invitation_access_grants_token_prefix_index').on(table.grantTokenPrefix),
    index('invitation_access_grants_expiration_index').on(table.expiresAt),
    index('invitation_access_grants_invitation_id_index').on(table.invitationId),
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

export const emailDeliveryAttempts = pgTable(
  'email_delivery_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id),
    guestId: uuid('guest_id')
      .notNull()
      .references(() => guests.id),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    channel: emailDeliveryChannel('channel').notNull().default('EMAIL'),
    status: emailDeliveryStatus('status').notNull().default('QUEUED'),
    provider: text('provider').notNull(),
    providerMessageId: text('provider_message_id'),
    providerStatus: text('provider_status'),
    attemptNumber: integer('attempt_number').notNull(),
    recipientHash: text('recipient_hash').notNull(),
    locale: text('locale').notNull(),
    subjectSnapshot: text('subject_snapshot').notNull(),
    templateVersion: integer('template_version').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    retryable: boolean('retryable').notNull().default(false),
    safeErrorCode: text('safe_error_code'),
    safeErrorMessage: text('safe_error_message'),
    queuedAt: timestamp('queued_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'date' }),
    failedAt: timestamp('failed_at', { withTimezone: true, mode: 'date' }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('email_delivery_attempts_idempotency_unique').on(table.idempotencyKey),
    uniqueIndex('email_delivery_attempts_guest_attempt_unique').on(
      table.guestId,
      table.attemptNumber,
    ),
    index('email_delivery_attempts_invitation_index').on(table.invitationId, table.createdAt),
    index('email_delivery_attempts_event_status_index').on(table.eventId, table.status),
    index('email_delivery_attempts_guest_created_index').on(table.guestId, table.createdAt),
    index('email_delivery_attempts_sending_updated_index').on(table.status, table.updatedAt),
    check('email_delivery_attempts_attempt_positive', sql`${table.attemptNumber} > 0`),
    check(
      'email_delivery_attempts_recipient_hash_check',
      sql`${table.recipientHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check('email_delivery_attempts_locale_check', sql`${table.locale} in ('en-US', 'es-MX')`),
    check(
      'email_delivery_attempts_snapshot_lengths_check',
      sql`length(${table.subjectSnapshot}) between 1 and 200 and length(${table.provider}) between 1 and 40 and length(${table.idempotencyKey}) between 1 and 100`,
    ),
    check(
      'email_delivery_attempts_idempotency_uuid_check',
      sql`${table.idempotencyKey} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`,
    ),
    check(
      'email_delivery_attempts_safe_error_lengths_check',
      sql`length(${table.safeErrorCode}) <= 80 and length(${table.safeErrorMessage}) <= 300`,
    ),
    check(
      'email_delivery_attempts_terminal_timestamp_check',
      sql`(${table.status} not in ('SENT', 'DELIVERED') or ${table.sentAt} is not null) and (${table.status} <> 'DELIVERED' or ${table.deliveredAt} is not null) and (${table.status} <> 'FAILED' or ${table.failedAt} is not null)`,
    ),
  ],
);

export const rsvps = pgTable(
  'rsvps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id),
    status: rsvpStatus('status').notNull(),
    totalAttending: integer('total_attending'),
    adultsAttending: integer('adults_attending'),
    childrenAttending: integer('children_attending'),
    dietaryNotes: text('dietary_notes'),
    guestMessage: text('guest_message'),
    respondedAt: timestamp('responded_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('rsvps_invitation_id_unique').on(table.invitationId),
    index('rsvps_status_index').on(table.status),
    index('rsvps_updated_at_index').on(table.updatedAt),
    check(
      'rsvps_attendance_non_negative_check',
      sql`${table.totalAttending} is null or ${table.totalAttending} >= 0`,
    ),
    check(
      'rsvps_adults_attending_non_negative_check',
      sql`${table.adultsAttending} is null or ${table.adultsAttending} >= 0`,
    ),
    check(
      'rsvps_children_attending_non_negative_check',
      sql`${table.childrenAttending} is null or ${table.childrenAttending} >= 0`,
    ),
    check(
      'rsvps_non_attending_counts_cleared_check',
      sql`${table.status} = 'ACCEPTED' or (${table.totalAttending} is null and ${table.adultsAttending} is null and ${table.childrenAttending} is null)`,
    ),
    check('rsvps_dietary_notes_length_check', sql`length(${table.dietaryNotes}) <= 500`),
    check('rsvps_guest_message_length_check', sql`length(${table.guestMessage}) <= 1000`),
  ],
);

export const rsvpHistory = pgTable(
  'rsvp_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rsvpId: uuid('rsvp_id')
      .notNull()
      .references(() => rsvps.id),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id),
    status: rsvpStatus('status').notNull(),
    totalAttending: integer('total_attending'),
    adultsAttending: integer('adults_attending'),
    childrenAttending: integer('children_attending'),
    dietaryNotes: text('dietary_notes'),
    guestMessage: text('guest_message'),
    source: rsvpChangeSource('source').notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('rsvp_history_rsvp_id_index').on(table.rsvpId),
    index('rsvp_history_invitation_id_created_at_index').on(table.invitationId, table.createdAt),
  ],
);
