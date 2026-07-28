CREATE TYPE "public"."rsvp_change_source" AS ENUM('INVITEE', 'HOST');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('ACCEPTED', 'DECLINED', 'NOT_SURE', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "rsvp_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rsvp_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"status" "rsvp_status" NOT NULL,
	"total_attending" integer,
	"adults_attending" integer,
	"children_attending" integer,
	"dietary_notes" text,
	"guest_message" text,
	"source" "rsvp_change_source" NOT NULL,
	"responded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"status" "rsvp_status" NOT NULL,
	"total_attending" integer,
	"adults_attending" integer,
	"children_attending" integer,
	"dietary_notes" text,
	"guest_message" text,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rsvps_attendance_non_negative_check" CHECK ("rsvps"."total_attending" is null or "rsvps"."total_attending" >= 0),
	CONSTRAINT "rsvps_adults_attending_non_negative_check" CHECK ("rsvps"."adults_attending" is null or "rsvps"."adults_attending" >= 0),
	CONSTRAINT "rsvps_children_attending_non_negative_check" CHECK ("rsvps"."children_attending" is null or "rsvps"."children_attending" >= 0),
	CONSTRAINT "rsvps_non_attending_counts_cleared_check" CHECK ("rsvps"."status" = 'ACCEPTED' or ("rsvps"."total_attending" is null and "rsvps"."adults_attending" is null and "rsvps"."children_attending" is null)),
	CONSTRAINT "rsvps_dietary_notes_length_check" CHECK (length("rsvps"."dietary_notes") <= 500),
	CONSTRAINT "rsvps_guest_message_length_check" CHECK (length("rsvps"."guest_message") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "rsvp_history" ADD CONSTRAINT "rsvp_history_rsvp_id_rsvps_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."rsvps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_history" ADD CONSTRAINT "rsvp_history_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rsvp_history_rsvp_id_index" ON "rsvp_history" USING btree ("rsvp_id");--> statement-breakpoint
CREATE INDEX "rsvp_history_invitation_id_created_at_index" ON "rsvp_history" USING btree ("invitation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rsvps_invitation_id_unique" ON "rsvps" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "rsvps_status_index" ON "rsvps" USING btree ("status");