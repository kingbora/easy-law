ALTER TABLE "case_change_log"
  ADD COLUMN "field_key" text,
  ADD COLUMN "field_label" text,
  ADD COLUMN "previous_value" text,
  ADD COLUMN "current_value" text,
  ADD COLUMN "remark" text;

ALTER TABLE "case_change_log"
  DROP COLUMN IF EXISTS "changes";
