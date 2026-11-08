CREATE TABLE "contact_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"publication_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"ip_hash" text,
	"handled_at" timestamp with time zone,
	"handled_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"publication_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"standfirst" text,
	"body" jsonb,
	"published" boolean DEFAULT true NOT NULL,
	"footer_group" text,
	"position" integer DEFAULT 0 NOT NULL,
	"contact_topic" text,
	"seo_title" text,
	"meta_description" text,
	"canonical_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_messages_pub_idx" ON "contact_messages" USING btree ("publication_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "site_pages_pub_slug_uq" ON "site_pages" USING btree ("publication_id","slug");