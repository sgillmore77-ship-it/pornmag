ALTER TABLE "review_details" ALTER COLUMN "score_max" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "review_details" ADD COLUMN "badge" text;--> statement-breakpoint
ALTER TABLE "review_details" ADD COLUMN "release_year" integer;--> statement-breakpoint
ALTER TABLE "video_details" ADD COLUMN "studio_entity_id" text;--> statement-breakpoint
ALTER TABLE "video_details" ADD CONSTRAINT "video_details_studio_entity_id_entities_id_fk" FOREIGN KEY ("studio_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;