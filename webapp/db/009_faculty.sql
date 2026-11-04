-- ============================================================
-- 009 — faculties (NFR-SCA-01)
--
-- The system is built for one faculty, but the data model should not need
-- a redesign when another faculty of Kalasin University joins. Programmes
-- now belong to a faculty, and a staff account can be limited to one
-- faculty (NULL = every faculty, as today). Alumni reach their faculty
-- through their programme, so nothing else has to change.
--
-- Idempotent:
--   docker exec -i ksu-alumni-db psql -U alumni -d alumni < db/009_faculty.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS faculty (
  id         serial PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  name_th    text NOT NULL,
  name_en    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO faculty (code, name_th, name_en)
VALUES ('eng', 'คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม', 'Faculty of Engineering and Industrial Technology')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE program ADD COLUMN IF NOT EXISTS faculty_id integer REFERENCES faculty(id);
UPDATE program SET faculty_id = (SELECT id FROM faculty WHERE code = 'eng') WHERE faculty_id IS NULL;
ALTER TABLE program ALTER COLUMN faculty_id SET NOT NULL;
-- New programmes default to the original faculty until a second one exists.
ALTER TABLE program ALTER COLUMN faculty_id SET DEFAULT 1;
CREATE INDEX IF NOT EXISTS program_faculty_idx ON program (faculty_id);

-- NULL = may work across all faculties (today's behaviour).
ALTER TABLE admin_user ADD COLUMN IF NOT EXISTS faculty_id integer REFERENCES faculty(id);

-- The faculty an alumnus studied in, for reports split by faculty.
CREATE OR REPLACE VIEW alumni_faculty AS
SELECT a.id AS alumni_id, p.faculty_id
FROM alumni a JOIN program p ON p.id = a.program_id;
