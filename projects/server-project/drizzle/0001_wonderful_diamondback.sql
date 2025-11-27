ALTER TABLE "case_record" ALTER COLUMN "litigation_fee_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."litigation_fee_type";--> statement-breakpoint
CREATE TYPE "public"."litigation_fee_type" AS ENUM('party_pay', 'law_firm_advance', 'other');--> statement-breakpoint
ALTER TABLE "case_record" ALTER COLUMN "litigation_fee_type" SET DATA TYPE "public"."litigation_fee_type" USING "litigation_fee_type"::"public"."litigation_fee_type";--> statement-breakpoint
ALTER TABLE "case_record" ALTER COLUMN "travel_fee_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."travel_fee_type";--> statement-breakpoint
CREATE TYPE "public"."travel_fee_type" AS ENUM('law_firm_advance', 'reimbursed', 'other');--> statement-breakpoint
ALTER TABLE "case_record" ALTER COLUMN "travel_fee_type" SET DATA TYPE "public"."travel_fee_type" USING "travel_fee_type"::"public"."travel_fee_type";--> statement-breakpoint
ALTER TABLE "case_record" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "case_record" ADD COLUMN "city" text;--> statement-breakpoint
UPDATE "case_record"
SET
	"province" = COALESCE(
		NULLIF((regexp_split_to_array("province_city", '[-\\s/、，。；]+'))[1], ''),
		NULLIF("province_city", '')
	),
	"city" = NULLIF((regexp_split_to_array("province_city", '[-\\s/、，。；]+'))[2], '')
WHERE "province_city" IS NOT NULL AND "province_city" <> '';--> statement-breakpoint
ALTER TABLE "case_record" DROP COLUMN "province_city";--> statement-breakpoint
ALTER TABLE "case_record" DROP COLUMN "fee_standard";