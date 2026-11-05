ALTER TABLE "content_reports" ADD COLUMN "ip_hash" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "comments_blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "comments_blocked_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "comment_reports_once_uq" ON "comment_reports" USING btree ("comment_id","reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_pub_handle_uq" ON "memberships" USING btree ("publication_id",lower("handle"));