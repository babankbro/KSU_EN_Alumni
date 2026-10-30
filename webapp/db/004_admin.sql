-- ============================================================
-- Admin: staff accounts, sessions, editable site content, news workflow
-- Requirements: 03-Design/SRS v2.md §3.12 (FR-ADM-10 … FR-ADM-21)
--
-- Idempotent (IF NOT EXISTS / ON CONFLICT) so it can also be applied by
-- hand to a database that was initialised before this file existed:
--   docker exec -i ksu-alumni-db psql -U alumni -d alumni < db/004_admin.sql
-- ============================================================

DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('admin', 'editor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 'admin' manages accounts and everything else; 'editor' manages content only.
CREATE TABLE IF NOT EXISTS admin_user (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  display_name    text NOT NULL,
  password_hash   text NOT NULL,              -- bcrypt via pgcrypto crypt()
  role            admin_role NOT NULL DEFAULT 'editor',
  is_active       boolean NOT NULL DEFAULT true,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_user_email_idx ON admin_user (lower(email));

-- Only the SHA-256 of the session token is stored: a database leak does not
-- hand out live sessions.
CREATE TABLE IF NOT EXISTS admin_session (
  token_hash   text PRIMARY KEY,
  admin_id     uuid NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  ip_address   inet,
  user_agent   text
);
CREATE INDEX IF NOT EXISTS admin_session_admin_idx ON admin_session (admin_id);

-- ------------------------------------------------------------
-- Editable site content
-- ------------------------------------------------------------
-- Texts are a fixed, typed catalogue of keys rather than free-form pages:
-- the layout is part of the design system (Visual Design §5), staff change
-- the words and pictures inside it. `kind` drives the input the admin form
-- renders and the validation applied on save.
CREATE TABLE IF NOT EXISTS site_setting (
  key         text PRIMARY KEY,
  grp         text NOT NULL,                  -- section heading in the admin form
  label       text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('text', 'textarea', 'email', 'phone', 'url')),
  value       text NOT NULL,
  max_length  integer NOT NULL DEFAULT 200,
  sort_order  integer NOT NULL DEFAULT 100,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES admin_user(id) ON DELETE SET NULL
);

-- Image slots: a named place on the site that shows one picture.
-- file_id NULL means "use the built-in default" (fallback_path).
CREATE TABLE IF NOT EXISTS site_image (
  slot          text PRIMARY KEY,
  label         text NOT NULL,
  hint          text,
  fallback_path text NOT NULL,                -- /images/... shipped with the app
  alt_text      text NOT NULL,
  file_id       uuid REFERENCES file_object(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES admin_user(id) ON DELETE SET NULL
);

DO $$ BEGIN
  ALTER TYPE file_purpose ADD VALUE IF NOT EXISTS 'site_image';
EXCEPTION WHEN others THEN NULL; END $$;

-- ------------------------------------------------------------
-- News workflow additions
-- ------------------------------------------------------------
ALTER TABLE news ADD COLUMN IF NOT EXISTS is_pinned  boolean NOT NULL DEFAULT false;
ALTER TABLE news ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE news ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES admin_user(id) ON DELETE SET NULL;
-- created_by was free text in 001; keep it, and record the author's id too.
ALTER TABLE news ADD COLUMN IF NOT EXISTS author_id  uuid REFERENCES admin_user(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS news_public_idx ON news (published_at DESC) WHERE published_at IS NOT NULL;

-- ------------------------------------------------------------
-- Seed: current hard-coded texts become the initial values
-- ------------------------------------------------------------
INSERT INTO site_setting (key, grp, label, kind, value, max_length, sort_order) VALUES
('hero.eyebrow',   'หน้าแรก — ส่วนหัว (Hero)', 'ข้อความบรรทัดเล็กด้านบน',  'text',     'Faculty of Engineering and Industrial Technology · Kalasin University', 100, 10),
('hero.title',     'หน้าแรก — ส่วนหัว (Hero)', 'หัวข้อหลัก บรรทัดที่ 1',   'text',     'เครือข่ายศิษย์เก่า', 60, 20),
('hero.titleEm',   'หน้าแรก — ส่วนหัว (Hero)', 'หัวข้อหลัก บรรทัดที่ 2 (สีทอง)', 'text', 'คณะวิศวกรรมศาสตร์ฯ ม.กาฬสินธุ์', 60, 30),
('hero.lead',      'หน้าแรก — ส่วนหัว (Hero)', 'คำอธิบายใต้หัวข้อ',        'textarea', 'รวมพลังศิษย์เก่าทุกรุ่นทุกสาขา ตั้งแต่ ปวส. ถึงปริญญาตรี เพื่อเชื่อมโยงรุ่นพี่รุ่นน้อง แบ่งปันโอกาสทางอาชีพ และร่วมพัฒนาหลักสูตรของคณะอย่างต่อเนื่อง', 260, 40),

('dean.quote',     'หน้าแรก — สารจากคณบดี',  'ข้อความ',                    'textarea', 'ศิษย์เก่าคือภาพสะท้อนที่ตรงที่สุดว่าคณะของเราผลิตบัณฑิตได้ตรงกับความต้องการของสังคมเพียงใด ระบบศิษย์เก่านี้จึงไม่ได้ทำขึ้นเพื่อเก็บรายชื่อ แต่ทำขึ้นเพื่อให้เสียงของศิษย์เก่ากลับมาถึงห้องเรียน และเพื่อให้รุ่นพี่ส่งต่อโอกาสให้รุ่นน้องได้จริง', 600, 10),
('dean.name',      'หน้าแรก — สารจากคณบดี',  'ชื่อ / ตำแหน่ง',             'text',     'คณบดีคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม', 100, 20),
('dean.org',       'หน้าแรก — สารจากคณบดี',  'หน่วยงาน',                   'text',     'มหาวิทยาลัยกาฬสินธุ์', 100, 30),

('contact.unit',   'ข้อมูลติดต่อ',            'ชื่อหน่วยงาน',               'text',     'งานศิษย์เก่าสัมพันธ์ คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม', 120, 10),
('contact.address','ข้อมูลติดต่อ',            'ที่อยู่',                     'textarea', 'มหาวิทยาลัยกาฬสินธุ์ อำเภอเมือง จังหวัดกาฬสินธุ์ 46000', 300, 20),
('contact.phone',  'ข้อมูลติดต่อ',            'โทรศัพท์',                   'phone',    '043-602-053', 20, 30),
('contact.email',  'ข้อมูลติดต่อ',            'อีเมล',                      'email',    'alumni.eng@ksu.ac.th', 120, 40),
('contact.line',   'ข้อมูลติดต่อ',            'LINE Official Account',     'text',     '@ksu-eng-alumni', 60, 50),

('social.facebook','ลิงก์โซเชียล',            'Facebook (URL)',            'url',      '', 300, 10),
('social.line',    'ลิงก์โซเชียล',            'LINE OA (URL)',             'url',      '', 300, 20),
('social.youtube', 'ลิงก์โซเชียล',            'YouTube (URL)',             'url',      '', 300, 30),

('footer.about',   'ส่วนท้ายเว็บ',            'คำอธิบายเครือข่าย',          'textarea', 'เครือข่ายศิษย์เก่าคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม เพื่อเชื่อมโยงรุ่นพี่รุ่นน้อง ส่งต่อโอกาสทางอาชีพ และร่วมพัฒนาหลักสูตรของคณะ', 300, 10)
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_image (slot, label, hint, fallback_path, alt_text) VALUES
('hero',      'ภาพพื้นหลังหน้าแรก', 'แนะนำภาพแนวนอนอย่างน้อย 1920×1080 px ภาพจริงของคณะหรือกิจกรรมศิษย์เก่า (Visual Design §5.3)',
              '/images/hero-alumni.png', 'ศิษย์เก่าและนักศึกษาวิศวกรรมศาสตร์แลกเปลี่ยนประสบการณ์ในมหาวิทยาลัย'),
('dean',      'ภาพคณบดี',          'แนะนำภาพแนวตั้งสัดส่วน 3:4',
              '', 'ภาพคณบดีคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม'),
('news.default', 'ภาพปกข่าวเริ่มต้น', 'ใช้กับข่าวที่ไม่ได้แนบภาพปก สัดส่วน 16:10',
              '', 'ภาพปกข่าวคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม')
ON CONFLICT (slot) DO NOTHING;

-- Existing seeded news predates author tracking; mark them published.
UPDATE news SET updated_at = COALESCE(published_at, created_at) WHERE updated_at IS NULL;
