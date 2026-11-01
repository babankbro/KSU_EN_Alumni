-- ============================================================
-- 007 — directory speed (NFR-PERF-02/03)
--
-- Every directory count and facet scanned the view, and the view worked out
-- each person's latest directory consent (DISTINCT ON over consent_log) and
-- current job (LATERAL ... LIMIT 1) again for all rows. At 20,000 alumni that
-- was ~80 ms per query and 8 queries per page, which capped the whole site at
-- ~22 requests/s. Both answers are now kept on the alumni row by triggers, so
-- the view joins on keys and PostgreSQL can skip joins a query does not use.
--
-- Idempotent:
--   docker exec -i ksu-alumni-db psql -U alumni -d alumni < db/007_directory_speed.sql
-- ============================================================

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS directory_consent boolean NOT NULL DEFAULT false;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_employment_id integer;
DO $$ BEGIN
  ALTER TABLE alumni ADD CONSTRAINT alumni_current_employment_fk
    FOREIGN KEY (current_employment_id) REFERENCES employment(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Latest directory_listing decision wins (consent is append-only).
CREATE OR REPLACE FUNCTION refresh_directory_consent(p_alumni uuid) RETURNS void AS $$
  UPDATE alumni a SET directory_consent = coalesce((
    SELECT cl.granted FROM consent_log cl
    WHERE cl.alumni_id = a.id AND cl.purpose = 'directory_listing'
    ORDER BY cl.recorded_at DESC, cl.id DESC LIMIT 1), false)
  WHERE a.id = p_alumni;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION refresh_current_employment(p_alumni uuid) RETURNS void AS $$
  UPDATE alumni a SET current_employment_id = (
    SELECT e.id FROM employment e
    WHERE e.alumni_id = a.id AND e.is_current
    ORDER BY e.start_month DESC NULLS LAST, e.id DESC LIMIT 1)
  WHERE a.id = p_alumni;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION consent_log_directory_sync() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.alumni_id IS NOT NULL THEN PERFORM refresh_directory_consent(OLD.alumni_id); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.alumni_id IS NOT NULL THEN PERFORM refresh_directory_consent(NEW.alumni_id); END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION employment_current_sync() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN PERFORM refresh_current_employment(OLD.alumni_id); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.alumni_id IS DISTINCT FROM OLD.alumni_id) THEN
    PERFORM refresh_current_employment(NEW.alumni_id);
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consent_log_directory ON consent_log;
CREATE TRIGGER consent_log_directory AFTER INSERT OR UPDATE OR DELETE ON consent_log
  FOR EACH ROW EXECUTE FUNCTION consent_log_directory_sync();
DROP TRIGGER IF EXISTS employment_current ON employment;
CREATE TRIGGER employment_current AFTER INSERT OR UPDATE OR DELETE ON employment
  FOR EACH ROW EXECUTE FUNCTION employment_current_sync();

-- Backfill for existing rows.
UPDATE alumni a SET
  directory_consent = coalesce((SELECT cl.granted FROM consent_log cl
                                WHERE cl.alumni_id = a.id AND cl.purpose = 'directory_listing'
                                ORDER BY cl.recorded_at DESC, cl.id DESC LIMIT 1), false),
  current_employment_id = (SELECT e.id FROM employment e WHERE e.alumni_id = a.id AND e.is_current
                           ORDER BY e.start_month DESC NULLS LAST, e.id DESC LIMIT 1);

-- Same columns, same rows as before (checked with EXCEPT on 20,001 rows).
CREATE OR REPLACE VIEW directory_public AS
SELECT a.id, a.title_th, a.first_name_th, a.last_name_th, a.nickname,
       a.admission_year, a.graduation_year,
       a.program_id, pr.name_th AS program_name_th, pr.current_name_th AS program_current_name_th,
       pr.current_id AS program_current_id, pr.degree_level,
       a.profile_updated_at, a.completeness_score, a.is_notable, a.notable_citation, a.photo_file_id,
       c.province, c.visibility, c.field_visibility, c.email, c.phone, c.line_id,
       e.organization AS current_organization, e.position AS current_position, e.job_category AS current_job_category
FROM alumni a
JOIN program_resolved pr ON pr.id = a.program_id
LEFT JOIN alumni_contact c ON c.alumni_id = a.id
LEFT JOIN employment e ON e.id = a.current_employment_id
WHERE a.claim_status = 'verified' AND NOT a.is_deceased AND a.anonymized_at IS NULL AND a.directory_consent;

CREATE INDEX IF NOT EXISTS alumni_directory_idx ON alumni (admission_year DESC, first_name_th)
  WHERE claim_status = 'verified' AND NOT is_deceased AND anonymized_at IS NULL AND directory_consent;
ANALYZE alumni;
