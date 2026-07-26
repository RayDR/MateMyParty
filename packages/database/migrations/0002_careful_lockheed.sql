CREATE TYPE "public"."event_animation_mode" AS ENUM('NONE', 'SUBTLE', 'IMMERSIVE');--> statement-breakpoint
CREATE TABLE "event_localizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"celebrant_name" text NOT NULL,
	"venue_name" text,
	"host_message" text,
	"arrival_instructions" text,
	"thumbnail_alt_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_localizations_locale_check" CHECK ("event_localizations"."locale" in ('en-US', 'es-MX'))
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "public_code" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "animation_mode" "event_animation_mode" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "video_background_ref" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "static_fallback_ref" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "audio_ref" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "animation_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "audio_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "overlay_intensity" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "thumbnail_image_ref" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "static_background_ref" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "maps_url" text;--> statement-breakpoint
UPDATE "events"
SET "public_code" = translate(upper(substr(md5(gen_random_uuid()::text), 1, 10)), '01', '23');--> statement-breakpoint
UPDATE "events"
SET
	"public_code" = 'SQ52LQE9',
	"animation_mode" = 'IMMERSIVE',
	"video_background_ref" = '/private-media/raymundo-6/dragons-intro.mp4',
	"audio_ref" = '/private-media/raymundo-6/dragons-theme.mp3',
	"animation_enabled" = true,
	"audio_enabled" = true
WHERE lower("public_slug") = 'raymundo-6';--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "public_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_localizations" ADD CONSTRAINT "event_localizations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "event_localizations" (
	"event_id",
	"locale",
	"title",
	"celebrant_name",
	"venue_name",
	"host_message",
	"arrival_instructions",
	"thumbnail_alt_text"
)
SELECT
	"id",
	locale,
	CASE
		WHEN lower("public_slug") = 'raymundo-6' AND locale = 'es-MX' THEN 'Sexto cumpleaños de Raymundo'
		ELSE "title"
	END,
	"celebrant_name",
	"venue_name",
	"host_message",
	NULL,
	CASE
		WHEN lower("public_slug") = 'raymundo-6' AND locale = 'es-MX' THEN 'Sexto cumpleaños de Raymundo'
		ELSE "title"
	END
FROM "events"
CROSS JOIN (VALUES ('en-US'), ('es-MX')) AS supported_locales(locale);--> statement-breakpoint
CREATE UNIQUE INDEX "event_localizations_event_locale_unique" ON "event_localizations" USING btree ("event_id","locale");--> statement-breakpoint
CREATE INDEX "event_localizations_event_id_index" ON "event_localizations" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_public_code_unique" ON "events" USING btree ("public_code");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_public_code_format_check" CHECK ("events"."public_code" ~ '^[A-HJ-NP-Z2-9]{8,10}$');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_template_key_check" CHECK ("events"."template_key" in ('kids-night-dragon', 'envelope-reveal', 'winter-snow', 'adventure-gates'));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_overlay_intensity_check" CHECK ("events"."overlay_intensity" between 0 and 100);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_end_after_start_check" CHECK ("events"."ends_at" is null or "events"."ends_at" > "events"."starts_at");
