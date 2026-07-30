ALTER TABLE "invitations" ADD COLUMN "first_visited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "last_visited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "visit_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_visit_count_non_negative" CHECK ("invitations"."visit_count" >= 0);--> statement-breakpoint
-- Previous opening metrics were recorded when the private link was loaded.
-- Preserve those values as link visits and begin explicit opening metrics from zero.
UPDATE "invitations"
SET
  "first_visited_at" = "first_opened_at",
  "last_visited_at" = "last_opened_at",
  "visit_count" = "open_count",
  "first_opened_at" = NULL,
  "last_opened_at" = NULL,
  "open_count" = 0,
  "status" = CASE
    WHEN "status" = 'OPENED'
      AND EXISTS (
        SELECT 1
        FROM "email_delivery_attempts"
        WHERE "email_delivery_attempts"."invitation_id" = "invitations"."id"
          AND "email_delivery_attempts"."status" IN ('SENT', 'DELIVERED')
      )
      THEN 'SENT'::"public"."invitation_status"
    WHEN "status" = 'OPENED'
      THEN 'READY'::"public"."invitation_status"
    ELSE "status"
  END;
--> statement-breakpoint
-- Existing OPENED activities represent legacy link loads, not explicit invitation openings.
DELETE FROM "invitation_activities"
WHERE "type" = 'OPENED';
