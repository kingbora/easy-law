ALTER TABLE "case_change_log" ADD COLUMN "group_id" uuid DEFAULT gen_random_uuid() NOT NULL;

WITH grouped_logs AS (
	SELECT
		id,
		first_value(id) OVER (
			PARTITION BY case_id, action, actor_id, actor_name, created_at
			ORDER BY id
		) AS leader_id
	FROM "case_change_log"
)
UPDATE "case_change_log" AS logs
SET "group_id" = grouped_logs.leader_id
FROM grouped_logs
WHERE logs.id = grouped_logs.id;