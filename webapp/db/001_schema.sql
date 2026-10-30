-- ============================================================
-- KSU Engineering Alumni — PostgreSQL schema
-- Design doc: 03-Design/Database Design.md
-- Requirements: 03-Design/SRS v2.md
--
-- Runs automatically on first container start via
-- /docker-entrypoint-initdb.d (see docker-compose.yml).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy Thai name search (FR-DIR-10)

-- ------------------------------------------------------------
-- Enumerations
-- ------------------------------------------------------------

-- Degree abbreviations as used by KSU registrar.
CREATE TYPE degree_level AS ENUM ('ปวส.', 'อส.บ.', 'ทล.บ.', 'วศ.บ.', 'สถ.บ.', 'วศ.ม.');

-- How long / which entry route. A faculty that admits ม.6, ปวช. and ปวส.
-- intake into the same discipline needs this separate from the discipline.
CREATE TYPE study_plan AS ENUM ('2ปี', '3ปี', '4ปี', 'เทียบโอน', 'ต่อเนื่อง');

-- Programme lifecycle. 'renamed' means a successor row exists (see
-- program.successor_id); 'closed' means no successor.
CREATE TYPE program_status AS ENUM ('active', 'renamed', 'closed', 'planned');

-- Provenance of a taxonomy row. Alumni will be matched against these names,
-- so the registrar export is the only source treated as authoritative.
CREATE TYPE source_kind AS ENUM ('registrar', 'web_official', 'web_secondary', 'user_reported');

-- FR-AUTH-01 / FR-DIR-07
CREATE TYPE claim_status AS ENUM ('unclaimed', 'pending', 'verified', 'rejected');

-- FR-PROF-03
CREATE TYPE visibility AS ENUM ('public', 'members', 'private');

-- FR-AUTH-05 — each purpose is consented to separately.
CREATE TYPE consent_purpose AS ENUM ('data_processing', 'directory_listing', 'news');

CREATE TYPE registration_path AS ENUM ('claim', 'new');
CREATE TYPE registration_status AS ENUM ('submitted', 'matched', 'approved', 'rejected');

CREATE TYPE file_purpose AS ENUM ('profile_photo', 'document', 'news_image', 'event_cover');

CREATE TYPE employment_sector AS ENUM ('รัฐ', 'รัฐวิสาหกิจ', 'เอกชน', 'ประกอบกิจการเอง', 'อื่นๆ');

-- FR-ANEWS-02 / FR-ANEWS-08
-- NOTE: enum labels are capped at 63 bytes; Thai is 3 bytes per character,
-- so keep every label at 21 Thai characters or fewer.
CREATE TYPE alumni_news_type AS ENUM (
  'ความก้าวหน้าในอาชีพ', 'รางวัล/ความสำเร็จ', 'ธุรกิจ/ผลงานใหม่',
  'กิจกรรมรุ่น', 'ประชาสัมพันธ์ทั่วไป', 'ข่าวไว้อาลัย'
);
CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'changes_requested', 'rejected');
CREATE TYPE post_visibility AS ENUM ('public', 'members', 'cohort');

CREATE TYPE employment_type AS ENUM ('งานประจำ', 'ฝึกงาน', 'สหกิจศึกษา');

-- ------------------------------------------------------------
-- Programme taxonomy (with lineage)
-- ------------------------------------------------------------
CREATE TABLE program (
  id              serial PRIMARY KEY,
  code            text NOT NULL UNIQUE,            -- stable key, e.g. 'beng-cpe'
  name_th         text NOT NULL,
  name_en         text,
  degree_level    degree_level NOT NULL,
  study_plan      study_plan NOT NULL,
  status          program_status NOT NULL DEFAULT 'active',
  -- Lineage: the row this one replaced. Alumni keep pointing at the name that
  -- was current when they studied; the UI follows successor_id to show the
  -- present-day name beside it.
  successor_id    integer REFERENCES program(id),
  valid_from_year integer,                         -- พ.ศ.; NULL = unknown
  valid_to_year   integer,                         -- พ.ศ.; NULL = still open
  source          source_kind NOT NULL,
  source_note     text,                            -- URL or who reported it
  verified        boolean NOT NULL DEFAULT false,  -- confirmed with registrar
  sort_order      integer NOT NULL DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_years_ck CHECK (
    valid_to_year IS NULL OR valid_from_year IS NULL OR valid_to_year >= valid_from_year
  ),
  CONSTRAINT program_successor_ck CHECK (successor_id IS NULL OR successor_id <> id)
);
COMMENT ON TABLE program IS
  'Every programme the faculty (and its predecessors) has run. Never delete rows: alumni reference them.';
CREATE INDEX program_level_idx ON program (degree_level, status, sort_order);

-- ------------------------------------------------------------
-- Alumni core
-- ------------------------------------------------------------
CREATE TABLE alumni (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code       text UNIQUE,                   -- NULL for pre-registrar alumni
  title_th           text NOT NULL,
  first_name_th      text NOT NULL,
  last_name_th       text NOT NULL,
  first_name_en      text,
  last_name_en       text,
  nickname           text,
  birth_date         date,
  -- Only the last four digits are ever collected (NFR-PDPA-04) and even those
  -- are stored hashed; they exist solely to corroborate a claim.
  id_last4_hash      text,
  program_id         integer NOT NULL REFERENCES program(id),
  admission_year     integer NOT NULL,              -- พ.ศ.
  graduation_year    integer,                       -- NULL = did not complete / unknown
  claim_status       claim_status NOT NULL DEFAULT 'unclaimed',
  claimed_at         timestamptz,
  photo_file_id      uuid,                          -- FK added after file_object
  profile_updated_at timestamptz NOT NULL DEFAULT now(),   -- FR-PROF-04
  completeness_score smallint NOT NULL DEFAULT 0,          -- FR-PROF-05
  is_notable         boolean NOT NULL DEFAULT false,       -- FR-AWD-04
  notable_citation   text,
  is_deceased        boolean NOT NULL DEFAULT false,       -- set by admin only (FR-ANEWS-13)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alumni_years_ck CHECK (graduation_year IS NULL OR graduation_year >= admission_year),
  CONSTRAINT alumni_completeness_ck CHECK (completeness_score BETWEEN 0 AND 100)
);
CREATE INDEX alumni_program_idx   ON alumni (program_id);
CREATE INDEX alumni_cohort_idx    ON alumni (admission_year);
CREATE INDEX alumni_claim_idx     ON alumni (claim_status);
-- FR-DIR-10 — trigram index for tolerant Thai name search
CREATE INDEX alumni_name_trgm_idx ON alumni
  USING gin ((first_name_th || ' ' || last_name_th) gin_trgm_ops);

-- DR-01 / FR-PROF-07
CREATE TABLE alumni_former_name (
  id            serial PRIMARY KEY,
  alumni_id     uuid NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  first_name_th text NOT NULL,
  last_name_th  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX former_name_trgm_idx ON alumni_former_name
  USING gin ((first_name_th || ' ' || last_name_th) gin_trgm_ops);

-- Split from alumni so privacy rules stay local (FR-PROF-03, FR-DIR-06).
CREATE TABLE alumni_contact (
  alumni_id  uuid PRIMARY KEY REFERENCES alumni(id) ON DELETE CASCADE,
  email      text,
  phone      text,
  line_id    text,
  province   text,
  country    text NOT NULL DEFAULT 'ไทย',
  visibility visibility NOT NULL DEFAULT 'members',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX alumni_contact_email_idx ON alumni_contact (lower(email)) WHERE email IS NOT NULL;

-- Time series, not a single current job (FR-SVY-07).
CREATE TABLE employment (
  id                  serial PRIMARY KEY,
  alumni_id           uuid NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  organization        text NOT NULL,
  position            text NOT NULL,
  job_category        text,
  sector              employment_sector,
  salary_band         text,                         -- FR-SVY-08: band only, never a figure
  start_month         date,                         -- first of month
  end_month           date,
  is_current          boolean NOT NULL DEFAULT false,
  is_related_to_major boolean,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employment_alumni_idx ON employment (alumni_id, is_current);
CREATE INDEX employment_org_idx    ON employment (lower(organization));

CREATE TABLE skill (
  id   serial PRIMARY KEY,
  name text NOT NULL UNIQUE
);
CREATE TABLE alumni_skill (
  alumni_id uuid    NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  skill_id  integer NOT NULL REFERENCES skill(id)  ON DELETE CASCADE,
  PRIMARY KEY (alumni_id, skill_id)
);

-- ------------------------------------------------------------
-- Files (MinIO objects)
-- ------------------------------------------------------------
CREATE TABLE file_object (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket          text NOT NULL,
  object_key      text NOT NULL,
  content_type    text NOT NULL,
  size_bytes      bigint NOT NULL CHECK (size_bytes >= 0),
  purpose         file_purpose NOT NULL,
  owner_alumni_id uuid REFERENCES alumni(id) ON DELETE SET NULL,
  uploaded_by     text,                             -- actor label
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, object_key)
);
ALTER TABLE alumni
  ADD CONSTRAINT alumni_photo_fk FOREIGN KEY (photo_file_id) REFERENCES file_object(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- Registration & consent (FR-AUTH-01/02/05)
-- ------------------------------------------------------------
-- The raw submission is kept verbatim so a reviewer can see exactly what the
-- applicant sent, independent of any later edits to the alumni row.
CREATE TABLE registration_request (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path        registration_path NOT NULL,
  status      registration_status NOT NULL DEFAULT 'submitted',
  payload     jsonb NOT NULL,
  photo_file_id uuid REFERENCES file_object(id) ON DELETE SET NULL,
  alumni_id   uuid REFERENCES alumni(id) ON DELETE SET NULL,  -- set once matched/approved
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX registration_status_idx ON registration_request (status, created_at);

-- NFR-PDPA-01 — every consent decision is a dated, versioned record.
CREATE TABLE consent_log (
  id             bigserial PRIMARY KEY,
  alumni_id      uuid REFERENCES alumni(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES registration_request(id) ON DELETE SET NULL,
  purpose        consent_purpose NOT NULL,
  granted        boolean NOT NULL,
  policy_version text NOT NULL,
  ip_address     inet,
  user_agent     text,
  recorded_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_alumni_idx ON consent_log (alumni_id, purpose, recorded_at DESC);

-- ------------------------------------------------------------
-- Content: official news, alumni-authored posts, events, jobs
-- ------------------------------------------------------------
CREATE TABLE news (
  id           serial PRIMARY KEY,
  title        text NOT NULL,
  summary      text,
  body         text,
  category     text,
  cover_file_id uuid REFERENCES file_object(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE alumni_post (
  id                serial PRIMARY KEY,
  author_id         uuid NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  type              alumni_news_type NOT NULL,
  title             text NOT NULL,
  body              text NOT NULL,
  visibility        post_visibility NOT NULL DEFAULT 'members',
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  moderated_by      text,
  moderated_at      timestamptz,
  moderation_note   text,
  is_pinned         boolean NOT NULL DEFAULT false,
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alumni_post_feed_idx ON alumni_post (moderation_status, is_pinned DESC, published_at DESC);

-- FR-ANEWS-03/04 — tags that the tagged person can decline
CREATE TABLE alumni_post_tag (
  post_id   integer NOT NULL REFERENCES alumni_post(id) ON DELETE CASCADE,
  alumni_id uuid    NOT NULL REFERENCES alumni(id)      ON DELETE CASCADE,
  declined  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (post_id, alumni_id)
);

CREATE TABLE event (
  id                serial PRIMARY KEY,
  title             text NOT NULL,
  description       text,
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz,
  venue             text,
  is_online         boolean NOT NULL DEFAULT false,
  registration_open boolean NOT NULL DEFAULT false,
  capacity          integer,
  cover_file_id     uuid REFERENCES file_object(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_time_ck CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE TABLE event_registration (
  event_id   integer NOT NULL REFERENCES event(id)  ON DELETE CASCADE,
  alumni_id  uuid    NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, alumni_id)
);

CREATE TABLE job_post (
  id                 serial PRIMARY KEY,
  posted_by          uuid REFERENCES alumni(id) ON DELETE SET NULL,  -- FR-JOB-01
  title              text NOT NULL,
  organization       text NOT NULL,
  employment_type    employment_type NOT NULL,
  location           text,
  description        text,
  closes_at          date,
  moderation_status  moderation_status NOT NULL DEFAULT 'pending',   -- FR-JOB-02
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE job_post_skill (
  job_post_id integer NOT NULL REFERENCES job_post(id) ON DELETE CASCADE,
  skill_id    integer NOT NULL REFERENCES skill(id)    ON DELETE CASCADE,
  PRIMARY KEY (job_post_id, skill_id)
);

-- ------------------------------------------------------------
-- Audit (FR-DIR-08, FR-ADM-07, DR-05)
-- ------------------------------------------------------------
CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  actor        text NOT NULL,            -- user id / 'anonymous' / 'system'
  action       text NOT NULL,            -- 'profile.view', 'registration.submit', ...
  target_table text,
  target_id    text,
  detail       jsonb,
  ip_address   inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_target_idx ON audit_log (target_table, target_id, created_at DESC);
-- DR-05: the log is append-only. A REVOKE alone does not bind the table owner
-- (the app connects as the owner), so enforce it with a trigger instead.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (DR-05)';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

-- ------------------------------------------------------------
-- Housekeeping triggers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER alumni_touch BEFORE UPDATE ON alumni
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER alumni_contact_touch BEFORE UPDATE ON alumni_contact
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ------------------------------------------------------------
-- Views used by the web app
-- ------------------------------------------------------------
-- Programme with its present-day name resolved through the lineage chain.
CREATE OR REPLACE VIEW program_resolved AS
WITH RECURSIVE chain AS (
  SELECT id AS origin_id, id, successor_id, 0 AS depth FROM program
  UNION ALL
  SELECT c.origin_id, p.id, p.successor_id, c.depth + 1
  FROM chain c JOIN program p ON p.id = c.successor_id
  WHERE c.depth < 10
)
SELECT p.*,
       cur.id      AS current_id,
       cur.name_th AS current_name_th
FROM program p
JOIN LATERAL (
  SELECT id FROM chain WHERE origin_id = p.id ORDER BY depth DESC LIMIT 1
) last ON true
JOIN program cur ON cur.id = last.id;

-- FR-DIR-07: the public directory never includes unclaimed rows.
CREATE OR REPLACE VIEW directory_public AS
SELECT a.id, a.title_th, a.first_name_th, a.last_name_th, a.nickname,
       a.admission_year, a.graduation_year,
       a.program_id, pr.name_th AS program_name_th, pr.current_name_th AS program_current_name_th,
       pr.degree_level,
       a.profile_updated_at, a.completeness_score, a.is_notable,
       c.province, c.visibility
FROM alumni a
JOIN program_resolved pr ON pr.id = a.program_id
LEFT JOIN alumni_contact c ON c.alumni_id = a.id
WHERE a.claim_status = 'verified' AND a.is_deceased = false;
