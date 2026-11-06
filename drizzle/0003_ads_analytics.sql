CREATE TYPE "public"."ad_kind" AS ENUM('code', 'image');--> statement-breakpoint
CREATE TABLE "ad_daily_stats" (
	"publication_id" text NOT NULL,
	"placement_id" text NOT NULL,
	"day" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ad_daily_stats_placement_id_day_pk" PRIMARY KEY("placement_id","day")
);
--> statement-breakpoint
CREATE TABLE "traffic_daily_stats" (
	"publication_id" text NOT NULL,
	"day" date NOT NULL,
	"source" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "traffic_daily_stats_publication_id_day_source_pk" PRIMARY KEY("publication_id","day","source")
);
--> statement-breakpoint
ALTER TABLE "ad_placements" ADD COLUMN "kind" "ad_kind" DEFAULT 'code' NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_placements" ADD COLUMN "image_id" text;--> statement-breakpoint
ALTER TABLE "ad_placements" ADD COLUMN "click_url" text;--> statement-breakpoint
ALTER TABLE "ad_placements" ADD COLUMN "alt_text" text;--> statement-breakpoint
ALTER TABLE "ad_placements" ADD COLUMN "advertiser" text;--> statement-breakpoint
ALTER TABLE "ad_placements" ADD COLUMN "weight" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_placements" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ad_placements" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ad_daily_stats" ADD CONSTRAINT "ad_daily_stats_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_daily_stats" ADD CONSTRAINT "ad_daily_stats_placement_id_ad_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."ad_placements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_daily_stats" ADD CONSTRAINT "traffic_daily_stats_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_stats_pub_day_idx" ON "ad_daily_stats" USING btree ("publication_id","day");--> statement-breakpoint
ALTER TABLE "ad_placements" ADD CONSTRAINT "ad_placements_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;