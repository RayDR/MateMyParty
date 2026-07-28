ALTER TABLE "event_localizations" ADD COLUMN "parking_instructions" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "public_thumbnail_ref" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_coordinates_pair_check" CHECK (("events"."latitude" is null and "events"."longitude" is null) or ("events"."latitude" is not null and "events"."longitude" is not null));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_latitude_range_check" CHECK ("events"."latitude" is null or "events"."latitude" between -90 and 90);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_longitude_range_check" CHECK ("events"."longitude" is null or "events"."longitude" between -180 and 180);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_maps_url_scheme_check" CHECK ("events"."maps_url" is null or "events"."maps_url" ~ '^https?://');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_public_thumbnail_ref_check" CHECK ("events"."public_thumbnail_ref" is null or "events"."public_thumbnail_ref" ~* '^(https://|/event-thumbnails/[a-z0-9-]+/[A-Za-z0-9._/-]+[.](avif|gif|jpe?g|png|webp)$)');