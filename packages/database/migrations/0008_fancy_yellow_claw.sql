CREATE TYPE "public"."email_delivery_channel" AS ENUM('EMAIL');--> statement-breakpoint
CREATE TYPE "public"."email_delivery_status" AS ENUM('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "email_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"channel" "email_delivery_channel" DEFAULT 'EMAIL' NOT NULL,
	"status" "email_delivery_status" DEFAULT 'QUEUED' NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"provider_status" text,
	"attempt_number" integer NOT NULL,
	"recipient_hash" text NOT NULL,
	"locale" text NOT NULL,
	"subject_snapshot" text NOT NULL,
	"template_version" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"retryable" boolean DEFAULT false NOT NULL,
	"safe_error_code" text,
	"safe_error_message" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_delivery_attempts_attempt_positive" CHECK ("email_delivery_attempts"."attempt_number" > 0),
	CONSTRAINT "email_delivery_attempts_recipient_hash_check" CHECK ("email_delivery_attempts"."recipient_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "email_delivery_attempts_locale_check" CHECK ("email_delivery_attempts"."locale" in ('en-US', 'es-MX')),
	CONSTRAINT "email_delivery_attempts_snapshot_lengths_check" CHECK (length("email_delivery_attempts"."subject_snapshot") between 1 and 200 and length("email_delivery_attempts"."provider") between 1 and 40 and length("email_delivery_attempts"."idempotency_key") between 1 and 100),
	CONSTRAINT "email_delivery_attempts_idempotency_uuid_check" CHECK ("email_delivery_attempts"."idempotency_key" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "email_delivery_attempts_safe_error_lengths_check" CHECK (length("email_delivery_attempts"."safe_error_code") <= 80 and length("email_delivery_attempts"."safe_error_message") <= 300),
	CONSTRAINT "email_delivery_attempts_terminal_timestamp_check" CHECK (("email_delivery_attempts"."status" not in ('SENT', 'DELIVERED') or "email_delivery_attempts"."sent_at" is not null) and ("email_delivery_attempts"."status" <> 'DELIVERED' or "email_delivery_attempts"."delivered_at" is not null) and ("email_delivery_attempts"."status" <> 'FAILED' or "email_delivery_attempts"."failed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "email_delivery_attempts" ADD CONSTRAINT "email_delivery_attempts_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_attempts" ADD CONSTRAINT "email_delivery_attempts_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_attempts" ADD CONSTRAINT "email_delivery_attempts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_delivery_attempts_idempotency_unique" ON "email_delivery_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "email_delivery_attempts_guest_attempt_unique" ON "email_delivery_attempts" USING btree ("guest_id","attempt_number");--> statement-breakpoint
CREATE INDEX "email_delivery_attempts_invitation_index" ON "email_delivery_attempts" USING btree ("invitation_id","created_at");--> statement-breakpoint
CREATE INDEX "email_delivery_attempts_event_status_index" ON "email_delivery_attempts" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "email_delivery_attempts_guest_created_index" ON "email_delivery_attempts" USING btree ("guest_id","created_at");--> statement-breakpoint
CREATE INDEX "email_delivery_attempts_sending_updated_index" ON "email_delivery_attempts" USING btree ("status","updated_at");
