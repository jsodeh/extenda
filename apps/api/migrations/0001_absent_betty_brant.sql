ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_refresh_token" text;