ALTER TABLE "case_change_log" ADD COLUMN "change_list" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "case_change_log" DROP COLUMN "group_id";--> statement-breakpoint
ALTER TABLE "case_change_log" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "case_change_log" DROP COLUMN "field_key";--> statement-breakpoint
ALTER TABLE "case_change_log" DROP COLUMN "field_label";--> statement-breakpoint
ALTER TABLE "case_change_log" DROP COLUMN "previous_value";--> statement-breakpoint
ALTER TABLE "case_change_log" DROP COLUMN "current_value";