CREATE TYPE "public"."invitation_lookup_method" AS ENUM('EMAIL', 'PHONE');--> statement-breakpoint
CREATE TABLE "invitation_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"grant_token_hash" text NOT NULL,
	"grant_token_prefix" text NOT NULL,
	"lookup_method" "invitation_lookup_method" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "invitation_access_grants" ADD CONSTRAINT "invitation_access_grants_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_access_grants_token_hash_unique" ON "invitation_access_grants" USING btree ("grant_token_hash");--> statement-breakpoint
CREATE INDEX "invitation_access_grants_token_prefix_index" ON "invitation_access_grants" USING btree ("grant_token_prefix");--> statement-breakpoint
CREATE INDEX "invitation_access_grants_expiration_index" ON "invitation_access_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "invitation_access_grants_invitation_id_index" ON "invitation_access_grants" USING btree ("invitation_id");