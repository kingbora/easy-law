CREATE TYPE "public"."department" AS ENUM('work_injury', 'insurance');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."case_category" AS ENUM('work_injury', 'insurance');--> statement-breakpoint
CREATE TYPE "public"."case_level" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('open', 'closed', 'void');--> statement-breakpoint
CREATE TYPE "public"."case_time_node_type" AS ENUM('apply_employment_confirmation', 'labor_arbitration_decision', 'submit_injury_certification', 'receive_injury_certification', 'submit_disability_assessment', 'receive_disability_assessment', 'apply_insurance_arbitration', 'insurance_arbitration_decision', 'file_lawsuit', 'lawsuit_review_approved', 'final_judgement');--> statement-breakpoint
CREATE TYPE "public"."case_type" AS ENUM('work_injury', 'personal_injury', 'other');--> statement-breakpoint
CREATE TYPE "public"."contract_form_type" AS ENUM('electronic', 'paper');--> statement-breakpoint
CREATE TYPE "public"."contract_quote_type" AS ENUM('fixed', 'risk', 'other');--> statement-breakpoint
CREATE TYPE "public"."litigation_fee_type" AS ENUM('advance', 'no_advance', 'reimbursed');--> statement-breakpoint
CREATE TYPE "public"."case_participant_entity" AS ENUM('personal', 'organization');--> statement-breakpoint
CREATE TYPE "public"."case_participant_role" AS ENUM('claimant', 'respondent');--> statement-breakpoint
CREATE TYPE "public"."travel_fee_type" AS ENUM('lawyer', 'reimbursed', 'no_advance');--> statement-breakpoint
CREATE TYPE "public"."case_trial_stage" AS ENUM('first_instance', 'second_instance', 'retrial');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_type" AS ENUM('custom', 'hearing');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"email_verified" boolean DEFAULT false,
	"image" text,
	"role" text DEFAULT 'assistant',
	"gender" "gender",
	"department" "department",
	"supervisor_id" text,
	"creator_id" text,
	"updater_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "case_change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"actor_role" text,
	"action" text NOT NULL,
	"description" text,
	"changes" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"received_at" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_hearing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"trial_lawyer_id" text,
	"hearing_time" timestamp,
	"hearing_location" text,
	"tribunal" text,
	"judge" text,
	"case_number" text,
	"contact_phone" text,
	"trial_stage" "case_trial_stage",
	"hearing_result" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"role" "case_participant_role" NOT NULL,
	"entity_type" "case_participant_entity",
	"name" text NOT NULL,
	"id_number" text,
	"phone" text,
	"address" text,
	"is_dishonest" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "case_table_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"table_key" text NOT NULL,
	"visible_columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_time_node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"node_type" "case_time_node_type" NOT NULL,
	"occurred_on" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"occurred_on" date NOT NULL,
	"follower_id" text,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_type" "case_type" NOT NULL,
	"case_level" "case_level" NOT NULL,
	"case_category" "case_category" DEFAULT 'work_injury' NOT NULL,
	"province_city" text,
	"target_amount" text,
	"fee_standard" text,
	"agency_fee_estimate" text,
	"data_source" text,
	"has_contract" boolean,
	"contract_date" date DEFAULT CURRENT_DATE,
	"clue_date" date,
	"has_social_security" boolean,
	"entry_date" date,
	"injury_location" text,
	"injury_severity" text,
	"injury_cause" text,
	"work_injury_certified" boolean,
	"monthly_salary" text,
	"appraisal_level" text,
	"appraisal_estimate" text,
	"existing_evidence" text,
	"customer_cooperative" boolean,
	"witness_cooperative" boolean,
	"remark" text,
	"contract_quote_type" "contract_quote_type",
	"contract_quote_amount" numeric(14, 2),
	"contract_quote_upfront" numeric(14, 2),
	"contract_quote_ratio" numeric(5, 2),
	"contract_quote_other" text,
	"estimated_collection" numeric(14, 2),
	"litigation_fee_type" "litigation_fee_type",
	"travel_fee_type" "travel_fee_type",
	"contract_form" "contract_form_type",
	"insurance_risk_level" "case_level",
	"insurance_types" jsonb DEFAULT '[]'::jsonb,
	"insurance_misrepresentations" jsonb DEFAULT '[]'::jsonb,
	"department" "department",
	"assigned_sale_id" text,
	"assigned_lawyer_id" text,
	"assigned_assistant_id" text,
	"case_status" "case_status" DEFAULT 'open',
	"closed_reason" text,
	"void_reason" text,
	"creator_id" text,
	"updater_id" text,
	"sales_commission" text,
	"handling_fee" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "calendar_event_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"tag_color" text NOT NULL,
	"event_date" date NOT NULL,
	"event_time" text,
	"related_case_id" uuid,
	"source_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_change_log" ADD CONSTRAINT "case_change_log_case_id_case_record_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_change_log" ADD CONSTRAINT "case_change_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_collection" ADD CONSTRAINT "case_collection_case_id_case_record_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_hearing" ADD CONSTRAINT "case_hearing_case_id_case_record_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_hearing" ADD CONSTRAINT "case_hearing_trial_lawyer_id_user_id_fk" FOREIGN KEY ("trial_lawyer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_participant" ADD CONSTRAINT "case_participant_case_id_case_record_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_table_preference" ADD CONSTRAINT "case_table_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_time_node" ADD CONSTRAINT "case_time_node_case_id_case_record_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_timeline" ADD CONSTRAINT "case_timeline_case_id_case_record_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_timeline" ADD CONSTRAINT "case_timeline_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_record" ADD CONSTRAINT "case_record_assigned_sale_id_user_id_fk" FOREIGN KEY ("assigned_sale_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_record" ADD CONSTRAINT "case_record_assigned_lawyer_id_user_id_fk" FOREIGN KEY ("assigned_lawyer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_record" ADD CONSTRAINT "case_record_assigned_assistant_id_user_id_fk" FOREIGN KEY ("assigned_assistant_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_record" ADD CONSTRAINT "case_record_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_record" ADD CONSTRAINT "case_record_updater_id_user_id_fk" FOREIGN KEY ("updater_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_related_case_id_case_record_id_fk" FOREIGN KEY ("related_case_id") REFERENCES "public"."case_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_table_preference_user_key_ui" ON "case_table_preference" USING btree ("user_id","table_key");--> statement-breakpoint
CREATE UNIQUE INDEX "case_time_node_case_type_ui" ON "case_time_node" USING btree ("case_id","node_type");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_source_user_ui" ON "calendar_event" USING btree ("source_id","user_id");