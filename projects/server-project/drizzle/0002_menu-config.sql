ALTER TYPE "public"."case_trial_stage" ADD VALUE 'arbitration' BEFORE 'first_instance';--> statement-breakpoint
CREATE TABLE "department_menu_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department" "department" NOT NULL,
	"data_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"trial_stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "department_menu_config" ADD CONSTRAINT "department_menu_config_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "department_menu_config_department_ui" ON "department_menu_config" USING btree ("department");