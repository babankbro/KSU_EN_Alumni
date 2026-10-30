-- ============================================================
-- 005 — schema for the remaining SRS modules
--   accounts & sessions (AUTH) · profile privacy (PROF) · directory (DIR)
--   alumni news interactions & moderation (ANEWS) · events (EVT)
--   jobs (JOB) · knowledge base (KB) · awards (AWD) · surveys (SVY)
--   notifications (NOTI) · news extras & gallery (NEWS)
--   import, merge, reference data, PDPA requests (ADM)
--
-- Idempotent, so it can be applied by hand to an existing database:
--   docker exec -i ksu-alumni-db psql -U alumni -d alumni < db/005_remaining_srs.sql
-- ============================================================

-- ---------- enum extensions ----------
ALTER TYPE admin_role        ADD VALUE IF NOT EXISTS 'faculty';      -- F: QA / awards committee
ALTER TYPE file_purpose      ADD VALUE IF NOT EXISTS 'attachment';   -- news PDF attachments
ALTER TYPE file_purpose      ADD VALUE IF NOT EXISTS 'gallery';
ALTER TYPE file_purpose      ADD VALUE IF NOT EXISTS 'nomination';   -- award evidence
ALTER TYPE moderation_status ADD VALUE IF NOT EXISTS 'hidden';       -- FR-ANEWS-12

DO $$ BEGIN CREATE TYPE account_role AS ENUM ('alumni', 'student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notif_channel AS ENUM ('in_app', 'email', 'line');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notif_status AS ENUM ('pending', 'sent', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pdpa_request_type AS ENUM ('access', 'rectify', 'delete', 'withdraw', 'object');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE request_status AS ENUM ('open', 'in_progress', 'done', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Rate limiting (FR-AUTH-06, FR-DIR-09)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_event (
  id         bigserial PRIMARY KEY,
  bucket     text NOT NULL,
  key        text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_event_lookup_idx ON rate_event (bucket, key, created_at DESC);

-- ============================================================
-- Alumni and student accounts (FR-AUTH-03/04/07/08)
-- ============================================================
CREATE TABLE IF NOT EXISTS account (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL,
  password_hash      text,                    -- NULL for LINE-only accounts
  role               account_role NOT NULL,
  alumni_id          uuid UNIQUE REFERENCES alumni(id) ON DELETE SET NULL,
  student_code       text,
  display_name       text NOT NULL,
  line_user_id       text UNIQUE,
  is_active          boolean NOT NULL DEFAULT true,
  -- FR-ANEWS-10: trusted posters skip pre-moderation (never for memorials)
  is_trusted_poster  boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_login_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS account_email_idx ON account (lower(email));

CREATE TABLE IF NOT EXISTS account_session (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);
CREATE INDEX IF NOT EXISTS account_session_account_idx ON account_session (account_id);

-- One-time tokens: password reset, data-confirmation links. Hash only.
CREATE TABLE IF NOT EXISTS account_token (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  purpose    text NOT NULL CHECK (purpose IN ('reset_password', 'confirm_data')),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE registration_request ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES account(id) ON DELETE SET NULL;

-- ============================================================
-- Profile privacy and lifecycle (FR-PROF-03, NFR-PDPA-03)
-- ============================================================
-- Per-field visibility: {"email":"members","phone":"private","line":"members",
-- "province":"public","workplace":"members","photo":"members"}; a missing key
-- falls back to alumni_contact.visibility.
ALTER TABLE alumni_contact ADD COLUMN IF NOT EXISTS field_visibility jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS anonymized_at   timestamptz;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS import_batch_id integer;

-- Latest decision per (alumni, purpose) — consent is append-only.
CREATE OR REPLACE VIEW alumni_latest_consent AS
SELECT DISTINCT ON (alumni_id, purpose) alumni_id, purpose, granted, recorded_at
FROM consent_log
WHERE alumni_id IS NOT NULL
ORDER BY alumni_id, purpose, recorded_at DESC, id DESC;

-- FR-DIR-07 + directory consent: verified, alive, not anonymised, and the
-- latest directory_listing consent is a yes. Seeded alumni without any
-- consent row are excluded, which is the safe default.
DROP VIEW IF EXISTS directory_public;
CREATE VIEW directory_public AS
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
LEFT JOIN LATERAL (
  SELECT organization, position, job_category FROM employment
  WHERE alumni_id = a.id AND is_current ORDER BY start_month DESC NULLS LAST LIMIT 1
) e ON true
JOIN alumni_latest_consent lc ON lc.alumni_id = a.id AND lc.purpose = 'directory_listing' AND lc.granted
WHERE a.claim_status = 'verified' AND NOT a.is_deceased AND a.anonymized_at IS NULL;

-- ============================================================
-- Reference data (FR-ADM-05)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_category (
  id         serial PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 100
);
INSERT INTO job_category (name, sort_order) VALUES
  ('วิศวกร', 10), ('ไอที/ซอฟต์แวร์', 20), ('ราชการ/รัฐวิสาหกิจ', 30),
  ('ประกอบกิจการเอง', 40), ('การศึกษา/วิจัย', 50), ('ช่างเทคนิค', 60), ('อื่น ๆ', 90)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PDPA data-subject requests (FR-PROF-08/09, FR-ADM-08)
-- ============================================================
CREATE TABLE IF NOT EXISTS pdpa_request (
  id          serial PRIMARY KEY,
  alumni_id   uuid REFERENCES alumni(id) ON DELETE SET NULL,
  account_id  uuid REFERENCES account(id) ON DELETE SET NULL,
  type        pdpa_request_type NOT NULL,
  detail      text,
  status      request_status NOT NULL DEFAULT 'open',
  handled_by  uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  handled_at  timestamptz,
  response    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Alumni news interactions (FR-ANEWS-07/11/12/16/17)
-- ============================================================
ALTER TABLE alumni_post ADD COLUMN IF NOT EXISTS is_draft   boolean NOT NULL DEFAULT false;
ALTER TABLE alumni_post ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE alumni_post ADD COLUMN IF NOT EXISTS image_file_id uuid REFERENCES file_object(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS alumni_post_reaction (
  post_id    integer NOT NULL REFERENCES alumni_post(id) ON DELETE CASCADE,
  account_id uuid    NOT NULL REFERENCES account(id)     ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, account_id)
);

CREATE TABLE IF NOT EXISTS alumni_post_comment (
  id                serial PRIMARY KEY,
  post_id           integer NOT NULL REFERENCES alumni_post(id) ON DELETE CASCADE,
  account_id        uuid    NOT NULL REFERENCES account(id)     ON DELETE CASCADE,
  body              text NOT NULL,
  moderation_status moderation_status NOT NULL DEFAULT 'approved',  -- post-moderated, reportable
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comment_post_idx ON alumni_post_comment (post_id, created_at);

CREATE TABLE IF NOT EXISTS content_report (
  id                  serial PRIMARY KEY,
  target_type         text NOT NULL CHECK (target_type IN ('post', 'comment', 'job', 'kb')),
  target_id           integer NOT NULL,
  reporter_account_id uuid REFERENCES account(id) ON DELETE SET NULL,
  reason              text NOT NULL,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by         uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_report_open_idx ON content_report (status, created_at);

-- ============================================================
-- Events (FR-EVT-01 … 06)
-- ============================================================
ALTER TABLE event ADD COLUMN IF NOT EXISTS registration_closes_at timestamptz;
ALTER TABLE event ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES admin_user(id) ON DELETE SET NULL;
ALTER TABLE event_registration ADD COLUMN IF NOT EXISTS reminded_at  timestamptz;
ALTER TABLE event_registration ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE TABLE IF NOT EXISTS event_item (             -- FR-EVT-06 souvenirs
  id          serial PRIMARY KEY,
  event_id    integer NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  name        text NOT NULL,
  price_baht  integer NOT NULL DEFAULT 0 CHECK (price_baht >= 0),
  stock       integer CHECK (stock IS NULL OR stock >= 0),  -- NULL = unlimited
  options     text[] NOT NULL DEFAULT '{}',                  -- e.g. sizes
  is_active   boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS event_order (
  id          serial PRIMARY KEY,
  item_id     integer NOT NULL REFERENCES event_item(id) ON DELETE CASCADE,
  alumni_id   uuid    NOT NULL REFERENCES alumni(id)     ON DELETE CASCADE,
  quantity    integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  option      text,
  status      text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'paid', 'delivered', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Jobs (FR-JOB-01 … 06)
-- ============================================================
ALTER TABLE job_post ADD COLUMN IF NOT EXISTS apply_url       text;
ALTER TABLE job_post ADD COLUMN IF NOT EXISTS contact_email   text;
ALTER TABLE job_post ADD COLUMN IF NOT EXISTS moderation_note text;
ALTER TABLE job_post ADD COLUMN IF NOT EXISTS approved_at     timestamptz;
ALTER TABLE job_post ADD COLUMN IF NOT EXISTS created_by_admin uuid REFERENCES admin_user(id) ON DELETE SET NULL;
ALTER TABLE job_post ADD COLUMN IF NOT EXISTS matched_notified_at timestamptz;
CREATE TABLE IF NOT EXISTS job_post_program (
  job_post_id integer NOT NULL REFERENCES job_post(id) ON DELETE CASCADE,
  program_id  integer NOT NULL REFERENCES program(id)  ON DELETE CASCADE,
  PRIMARY KEY (job_post_id, program_id)
);
UPDATE job_post SET approved_at = created_at WHERE moderation_status = 'approved' AND approved_at IS NULL;

-- ============================================================
-- Knowledge base (FR-KB-01 … 03)
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_article (
  id                serial PRIMARY KEY,
  author_id         uuid NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  title             text NOT NULL,
  summary           text,
  body              text NOT NULL,
  category          text NOT NULL,
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  moderation_note   text,
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Awards (FR-AWD-01 … 04)
-- ============================================================
CREATE TABLE IF NOT EXISTS award_round (
  id          serial PRIMARY KEY,
  title       text NOT NULL,
  description text,
  opens_at    timestamptz NOT NULL,
  closes_at   timestamptz NOT NULL,
  created_by  uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT award_round_window_ck CHECK (closes_at > opens_at)
);
CREATE TABLE IF NOT EXISTS award_nomination (
  id                   serial PRIMARY KEY,
  round_id             integer NOT NULL REFERENCES award_round(id) ON DELETE CASCADE,
  nominee_alumni_id    uuid REFERENCES alumni(id) ON DELETE SET NULL,
  nominee_name         text NOT NULL,
  nominee_detail       text,              -- cohort / programme as typed by the nominator
  nominator_account_id uuid REFERENCES account(id) ON DELETE SET NULL,
  reason               text NOT NULL,
  evidence_file_id     uuid REFERENCES file_object(id) ON DELETE SET NULL,
  status               text NOT NULL DEFAULT 'submitted'
                       CHECK (status IN ('submitted', 'shortlisted', 'awarded', 'not_selected')),
  committee_note       text,
  citation             text,              -- published wording when awarded
  decided_by           uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  decided_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Surveys (FR-SVY-01 … 08)
-- ============================================================
CREATE TABLE IF NOT EXISTS survey (
  id          serial PRIMARY KEY,
  title       text NOT NULL,
  description text,
  audience    text NOT NULL CHECK (audience IN ('alumni', 'employer')),
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  opens_at    timestamptz,
  closes_at   timestamptz,
  questions   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by  uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS employer_invite (     -- FR-SVY-04: no account needed
  id             serial PRIMARY KEY,
  token_hash     text NOT NULL UNIQUE,
  survey_id      integer NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
  alumni_id      uuid REFERENCES alumni(id) ON DELETE SET NULL,
  employer_name  text,
  employer_email text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  responded_at   timestamptz
);
CREATE TABLE IF NOT EXISTS survey_response (
  id                 serial PRIMARY KEY,
  survey_id          integer NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
  alumni_id          uuid REFERENCES alumni(id) ON DELETE SET NULL,
  employer_invite_id integer REFERENCES employer_invite(id) ON DELETE SET NULL,
  answers            jsonb NOT NULL,
  -- denormalised at submit time so reports survive later profile edits
  program_id         integer REFERENCES program(id),
  graduation_year    integer,
  years_since_grad   integer,                -- FR-SVY-07 timepoint
  submitted_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS survey_response_once_idx ON survey_response (survey_id, alumni_id) WHERE alumni_id IS NOT NULL;

-- ============================================================
-- Notifications (FR-NOTI-01 … 06, FR-ANEWS-21, FR-EVT-05, FR-JOB-06)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification (
  id          bigserial PRIMARY KEY,
  account_id  uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  type        text NOT NULL,
  channel     notif_channel NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  link        text,
  status      notif_status NOT NULL DEFAULT 'pending',
  attempts    integer NOT NULL DEFAULT 0,
  last_error  text,
  dedupe_key  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  read_at     timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS notification_dedupe_idx ON notification (dedupe_key, channel) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_outbox_idx ON notification (status, channel, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS notification_inbox_idx ON notification (account_id, created_at DESC) WHERE channel = 'in_app';

CREATE TABLE IF NOT EXISTS notification_pref (
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  type       text NOT NULL,
  in_app     boolean NOT NULL DEFAULT true,
  email      boolean NOT NULL DEFAULT true,
  line       boolean NOT NULL DEFAULT false,
  frequency  text NOT NULL DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'weekly', 'off')),
  PRIMARY KEY (account_id, type)
);

CREATE TABLE IF NOT EXISTS broadcast (           -- FR-NOTI-05
  id              serial PRIMARY KEY,
  title           text NOT NULL,
  body            text NOT NULL,
  link            text,
  filter          jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_count integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS data_confirm_round (  -- FR-NOTI-04
  id              serial PRIMARY KEY,
  stale_months    integer NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cron_run (            -- last run per scheduled task
  task       text PRIMARY KEY,
  last_run   timestamptz NOT NULL,
  detail     jsonb
);

-- ============================================================
-- News extras and gallery (FR-NEWS-02/03/04/05)
-- ============================================================
CREATE TABLE IF NOT EXISTS news_tag (
  news_id integer NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  tag     text NOT NULL,
  PRIMARY KEY (news_id, tag)
);
CREATE TABLE IF NOT EXISTS news_attachment (
  news_id integer NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  file_id uuid    NOT NULL REFERENCES file_object(id) ON DELETE CASCADE,
  label   text NOT NULL,
  PRIMARY KEY (news_id, file_id)
);
CREATE INDEX IF NOT EXISTS news_search_trgm_idx ON news USING gin ((title || ' ' || coalesce(summary, '')) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS gallery_album (
  id            serial PRIMARY KEY,
  title         text NOT NULL,
  description   text,
  event_id      integer REFERENCES event(id) ON DELETE SET NULL,
  is_published  boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gallery_photo (
  id        serial PRIMARY KEY,
  album_id  integer NOT NULL REFERENCES gallery_album(id) ON DELETE CASCADE,
  file_id   uuid    NOT NULL REFERENCES file_object(id)   ON DELETE CASCADE,
  caption   text,
  sort      integer NOT NULL DEFAULT 0
);

-- ============================================================
-- Import and merge (FR-ADM-01/02)
-- ============================================================
CREATE TABLE IF NOT EXISTS import_batch (
  id         serial PRIMARY KEY,
  filename   text NOT NULL,
  total      integer NOT NULL DEFAULT 0,
  inserted   integer NOT NULL DEFAULT 0,
  skipped    integer NOT NULL DEFAULT 0,
  errors     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE alumni ADD CONSTRAINT alumni_import_batch_fk
    FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS alumni_merge (
  id              serial PRIMARY KEY,
  kept_id         uuid NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  merged_id       uuid NOT NULL,            -- row no longer exists
  merged_snapshot jsonb NOT NULL,
  merged_by       uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  merged_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Sample data for the new modules (fictional; remove before go-live)
-- ============================================================
-- Directory consent for the seeded verified alumni who did not register
-- through the form: 003 recorded data_processing/directory/news consents for
-- them, so the directory view already includes them.

INSERT INTO kb_article (author_id, title, summary, body, category, moderation_status, published_at)
SELECT '00000000-0000-4000-8000-000000000001',
       'เตรียมตัวสัมภาษณ์งานสาย Software Engineer',
       'สิ่งที่รุ่นพี่อยากบอกก่อนไปสัมภาษณ์งานแรก',
       E'ฝึกโจทย์โครงสร้างข้อมูลพื้นฐานให้คล่อง และเตรียมเล่าโปรเจกต์จบของตัวเองให้ได้ภายใน 3 นาที\n\nบริษัทส่วนใหญ่ในภาคอีสานให้ความสำคัญกับการทำงานเป็นทีมมากกว่าคะแนนสอบ',
       'อาชีพและการทำงาน', 'approved', now() - interval '20 days'
WHERE NOT EXISTS (SELECT 1 FROM kb_article);

INSERT INTO award_round (title, description, opens_at, closes_at)
SELECT 'ศิษย์เก่าดีเด่น ประจำปี 2570',
       'เปิดรับการเสนอชื่อศิษย์เก่าที่สร้างคุณประโยชน์ต่อวิชาชีพ สังคม และคณะ',
       now() - interval '7 days', now() + interval '60 days'
WHERE NOT EXISTS (SELECT 1 FROM award_round);

INSERT INTO survey (title, description, audience, status, opens_at, closes_at, questions)
SELECT 'ภาวะการมีงานทำของบัณฑิต ประจำปี 2569',
       'ใช้เวลาประมาณ 5 นาที ข้อมูลใช้เพื่อปรับปรุงหลักสูตรและรายงานประกันคุณภาพ',
       'alumni', 'open', now() - interval '10 days', now() + interval '80 days',
       '[
         {"id":"status","type":"single","label":"สถานะการทำงานปัจจุบัน","required":true,
          "options":["ทำงานแล้ว","ศึกษาต่อ","ยังไม่ได้ทำงาน","ประกอบกิจการส่วนตัว"]},
         {"id":"organization","type":"text","label":"ชื่อหน่วยงาน/บริษัท","prefill":"employment.organization","showIf":{"status":["ทำงานแล้ว","ประกอบกิจการส่วนตัว"]}},
         {"id":"position","type":"text","label":"ตำแหน่ง","prefill":"employment.position","showIf":{"status":["ทำงานแล้ว","ประกอบกิจการส่วนตัว"]}},
         {"id":"sector","type":"single","label":"ประเภทหน่วยงาน","options":["รัฐ","รัฐวิสาหกิจ","เอกชน","ประกอบกิจการเอง","อื่นๆ"],"prefill":"employment.sector","showIf":{"status":["ทำงานแล้ว","ประกอบกิจการส่วนตัว"]}},
         {"id":"related","type":"single","label":"งานตรงกับสาขาที่จบหรือไม่","options":["ตรง","ไม่ตรง"],"showIf":{"status":["ทำงานแล้ว","ประกอบกิจการส่วนตัว"]}},
         {"id":"salary","type":"single","label":"รายได้ต่อเดือน (ช่วง)","options":["ไม่เกิน 15,000","15,001–20,000","20,001–30,000","30,001–40,000","40,001–50,000","มากกว่า 50,000"],"showIf":{"status":["ทำงานแล้ว","ประกอบกิจการส่วนตัว"]}},
         {"id":"months_to_job","type":"single","label":"ได้งานหลังจบกี่เดือน","options":["ก่อนจบ","ภายใน 3 เดือน","4–6 เดือน","7–12 เดือน","มากกว่า 1 ปี"],"showIf":{"status":["ทำงานแล้ว"]}},
         {"id":"curriculum","type":"scale","label":"หลักสูตรช่วยให้ทำงานได้มากน้อยเพียงใด","min":1,"max":5,"required":true},
         {"id":"suggestion","type":"textarea","label":"ข้อเสนอแนะต่อหลักสูตร"}
       ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM survey WHERE audience = 'alumni');

INSERT INTO survey (title, description, audience, status, opens_at, closes_at, questions)
SELECT 'ความพึงพอใจของผู้ใช้บัณฑิต ประจำปี 2569',
       'สำหรับหัวหน้างานหรือนายจ้างของบัณฑิตคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม',
       'employer', 'open', now() - interval '10 days', now() + interval '80 days',
       '[
         {"id":"knowledge","type":"scale","label":"ความรู้ความสามารถทางวิชาชีพ","min":1,"max":5,"required":true},
         {"id":"skills","type":"scale","label":"ทักษะการปฏิบัติงาน","min":1,"max":5,"required":true},
         {"id":"ethics","type":"scale","label":"คุณธรรม จริยธรรม และความรับผิดชอบ","min":1,"max":5,"required":true},
         {"id":"teamwork","type":"scale","label":"การทำงานร่วมกับผู้อื่น","min":1,"max":5,"required":true},
         {"id":"overall","type":"scale","label":"ความพึงพอใจโดยรวม","min":1,"max":5,"required":true},
         {"id":"comment","type":"textarea","label":"ข้อเสนอแนะต่อคณะ"}
       ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM survey WHERE audience = 'employer');
