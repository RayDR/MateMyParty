CREATE TYPE "public"."invitation_activity_type" AS ENUM('CREATED', 'OPENED', 'REVOKED', 'REGENERATED');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('DRAFT', 'READY', 'SENT', 'OPENED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."preferred_channel" AS ENUM('EMAIL', 'SMS', 'BOTH', 'MANUAL');--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"preferred_channel" "preferred_channel" NOT NULL,
	"locale" text NOT NULL,
	"adults_planned" integer,
	"children_planned" integer,
	"private_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "guests_adults_planned_non_negative" CHECK ("guests"."adults_planned" is null or "guests"."adults_planned" >= 0),
	CONSTRAINT "guests_children_planned_non_negative" CHECK ("guests"."children_planned" is null or "guests"."children_planned" >= 0),
	CONSTRAINT "guests_preferred_channel_contact_check" CHECK (("guests"."preferred_channel" = 'EMAIL' and "guests"."email" is not null) or
          ("guests"."preferred_channel" = 'SMS' and "guests"."phone" is not null) or
          ("guests"."preferred_channel" = 'BOTH' and "guests"."email" is not null and "guests"."phone" is not null) or
          ("guests"."preferred_channel" = 'MANUAL' and "guests"."email" is null and "guests"."phone" is null))
);
--> statement-breakpoint
CREATE TABLE "invitation_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"type" "invitation_activity_type" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"public_token_hash" text NOT NULL,
	"public_token_prefix" text NOT NULL,
	"status" "invitation_status" DEFAULT 'READY' NOT NULL,
	"locale" text NOT NULL,
	"first_opened_at" timestamp with time zone,
	"last_opened_at" timestamp with time zone,
	"open_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invitations_open_count_non_negative" CHECK ("invitations"."open_count" >= 0),
	CONSTRAINT "invitations_revoked_state_check" CHECK (("invitations"."status" = 'REVOKED' and "invitations"."revoked_at" is not null) or ("invitations"."status" <> 'REVOKED' and "invitations"."revoked_at" is null))
);
--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_activities" ADD CONSTRAINT "invitation_activities_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guests_event_id_index" ON "guests" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "invitation_activities_invitation_id_index" ON "invitation_activities" USING btree ("invitation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_public_token_hash_unique" ON "invitations" USING btree ("public_token_hash");--> statement-breakpoint
CREATE INDEX "invitations_public_token_prefix_index" ON "invitations" USING btree ("public_token_prefix");--> statement-breakpoint
CREATE INDEX "invitations_event_id_index" ON "invitations" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_one_active_per_guest_unique" ON "invitations" USING btree ("guest_id") WHERE "invitations"."revoked_at" is null;