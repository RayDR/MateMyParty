CREATE TYPE "public"."invitation_count_mode" AS ENUM('TOTAL_ONLY', 'ADULTS_AND_CHILDREN');--> statement-breakpoint
ALTER TABLE "guests" RENAME COLUMN "adults_planned" TO "adults_invited";--> statement-breakpoint
ALTER TABLE "guests" RENAME COLUMN "children_planned" TO "children_invited";--> statement-breakpoint
ALTER TABLE "guests" DROP CONSTRAINT "guests_adults_planned_non_negative";--> statement-breakpoint
ALTER TABLE "guests" DROP CONSTRAINT "guests_children_planned_non_negative";--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "invitation_count_mode" "invitation_count_mode" DEFAULT 'TOTAL_ONLY' NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "total_invited" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "guests"
SET
  "invitation_count_mode" = 'ADULTS_AND_CHILDREN',
  "adults_invited" = coalesce("adults_invited", 0),
  "children_invited" = coalesce("children_invited", 0),
  "total_invited" = coalesce("adults_invited", 0) + coalesce("children_invited", 0)
WHERE "adults_invited" IS NOT NULL OR "children_invited" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_invitation_count_consistency" CHECK (("guests"."invitation_count_mode" = 'TOTAL_ONLY' and "guests"."total_invited" >= 0 and "guests"."adults_invited" is null and "guests"."children_invited" is null) or
          ("guests"."invitation_count_mode" = 'ADULTS_AND_CHILDREN' and "guests"."adults_invited" is not null and "guests"."adults_invited" >= 0 and "guests"."children_invited" is not null and "guests"."children_invited" >= 0 and "guests"."total_invited" = "guests"."adults_invited" + "guests"."children_invited"));
