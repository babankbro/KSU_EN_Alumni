-- ============================================================
-- Sample alumni for the draft. EVERY PERSON HERE IS FICTIONAL.
-- Removed before go-live; the registrar import replaces it (FR-ADM-01).
-- ============================================================

-- Fixed UUIDs so the app's sample links stay stable across resets.
INSERT INTO alumni (id, student_code, title_th, first_name_th, last_name_th, first_name_en, last_name_en, nickname,
                    birth_date, id_last4_hash, program_id, admission_year, graduation_year, claim_status, claimed_at,
                    profile_updated_at, completeness_score, is_notable, notable_citation)
VALUES
-- วศ.บ. คอมพิวเตอร์ — current name
('00000000-0000-4000-8000-000000000001', '60130100142', 'นาย', 'อนุชา', 'พรมมา', 'Anucha', 'Promma', 'ชา',
 '1998-05-14', crypt('1234', gen_salt('bf')), (SELECT id FROM program WHERE code='beng-cpe'), 2560, 2564, 'verified', now() - interval '400 days',
 now() - interval '41 days', 92, false, NULL),
-- วศ.บ. ไฟฟ้า
('00000000-0000-4000-8000-000000000002', '62130200087', 'นางสาว', 'วรรณา', 'ดีงาม', 'Wanna', 'Deengam', 'หวาน',
 '2000-11-02', crypt('5678', gen_salt('bf')), (SELECT id FROM program WHERE code='beng-ee'), 2562, 2566, 'verified', now() - interval '200 days',
 now() - interval '80 days', 78, false, NULL),
-- วศ.บ. เครื่องกล — stale profile on purpose
('00000000-0000-4000-8000-000000000003', '57130300055', 'นาย', 'ธนพล', 'แก้วใส', 'Thanapol', 'Kaewsai', 'พล',
 '1995-01-20', crypt('9012', gen_salt('bf')), (SELECT id FROM program WHERE code='beng-me'), 2557, 2561, 'verified', now() - interval '900 days',
 now() - interval '640 days', 54, false, NULL),
-- วศ.บ. โลจิสติกส์
('00000000-0000-4000-8000-000000000004', '64130400211', 'นางสาว', 'ศิริพร', 'ภูผา', 'Siriporn', 'Phupha', 'พร',
 '2002-07-30', crypt('3456', gen_salt('bf')), (SELECT id FROM program WHERE code='beng-logi'), 2564, 2568, 'verified', now() - interval '60 days',
 now() - interval '55 days', 85, false, NULL),
-- Studied under the OLD name "วิศวกรรมคอมพิวเตอร์และระบบอัตโนมัติ" — exercises lineage
('00000000-0000-4000-8000-000000000005', '48130100003', 'นาย', 'สมชาย', 'ใจดี', 'Somchai', 'Jaidee', 'ชาย',
 '1986-03-08', crypt('7890', gen_salt('bf')), (SELECT id FROM program WHERE code='beng-cpe-auto'), 2561, 2565, 'verified', now() - interval '300 days',
 now() - interval '110 days', 96, true,
 'ผู้ก่อตั้งบริษัทซอฟต์แวร์ในภาคอีสาน และวิทยากรรับเชิญด้านระบบฝังตัวให้กับคณะอย่างต่อเนื่อง'),
-- Married name change — has a former name row
('00000000-0000-4000-8000-000000000006', '51130200019', 'นาง', 'สุดารัตน์', 'ทองมี', 'Sudarat', 'Thongmee', 'ดา',
 '1989-09-19', crypt('2345', gen_salt('bf')), (SELECT id FROM program WHERE code='beng-ee'), 2551, 2555, 'verified', now() - interval '250 days',
 now() - interval '48 days', 90, true,
 'วิศวกรระบบไฟฟ้าโครงการพลังงานหมุนเวียน ผู้ริเริ่มทุนการศึกษาสำหรับรุ่นน้องในสาขา'),
-- ปวส. ช่างยนต์ (legacy name, user-reported) — the lineage case the faculty asked about
('00000000-0000-4000-8000-000000000007', NULL, 'นาย', 'ประเสริฐ', 'มั่นคง', 'Prasert', 'Mankhong', 'เสริฐ',
 '1984-12-01', NULL, (SELECT id FROM program WHERE code='hvc-auto-legacy'), 2545, 2547, 'verified', now() - interval '500 days',
 now() - interval '130 days', 88, true,
 'ผู้จัดการโรงงานอุตสาหกรรมเกษตร และผู้รับนักศึกษาสหกิจศึกษาของคณะต่อเนื่อง 8 ปี'),
-- อส.บ. เทคโนโลยีอุตสาหการ (legacy)
('00000000-0000-4000-8000-000000000008', NULL, 'นางสาว', 'กนกวรรณ', 'ศรีสุข', 'Kanokwan', 'Srisuk', 'นก',
 '1990-04-22', NULL, (SELECT id FROM program WHERE code='bit-ie-legacy'), 2553, 2555, 'verified', now() - interval '20 days',
 now() - interval '4 days', 94, true,
 'ผู้เชี่ยวชาญด้านการวางแผนขนส่ง และผู้ก่อตั้งกลุ่มพี่เลี้ยงอาชีพสำหรับศิษย์เก่ารุ่นใหม่'),
-- Imported but NOT yet claimed: must never appear in the public directory (FR-DIR-07)
('00000000-0000-4000-8000-000000000009', '59130300120', 'นาย', 'วีระ', 'บุญมา', NULL, NULL, NULL,
 '1997-08-09', crypt('6789', gen_salt('bf')), (SELECT id FROM program WHERE code='beng-me'), 2559, 2563, 'unclaimed', NULL,
 now() - interval '700 days', 20, false, NULL);

INSERT INTO alumni_former_name (alumni_id, first_name_th, last_name_th) VALUES
('00000000-0000-4000-8000-000000000006', 'สุดารัตน์', 'แสงทอง');

INSERT INTO alumni_contact (alumni_id, email, phone, line_id, province, visibility) VALUES
('00000000-0000-4000-8000-000000000001', 'anucha.p@example.com', '0812345678', 'anucha.p', 'ขอนแก่น', 'members'),
('00000000-0000-4000-8000-000000000002', 'wanna.d@example.com', NULL, NULL, 'กาฬสินธุ์', 'members'),
('00000000-0000-4000-8000-000000000003', 'thanapol.k@example.com', NULL, NULL, 'ระยอง', 'private'),
('00000000-0000-4000-8000-000000000004', 'siriporn.p@example.com', NULL, NULL, 'กรุงเทพมหานคร', 'members'),
('00000000-0000-4000-8000-000000000005', 'somchai.j@example.com', NULL, NULL, 'กาฬสินธุ์', 'members'),
('00000000-0000-4000-8000-000000000006', 'sudarat.t@example.com', NULL, NULL, 'ขอนแก่น', 'members'),
('00000000-0000-4000-8000-000000000007', 'prasert.m@example.com', NULL, NULL, 'ระยอง', 'members'),
('00000000-0000-4000-8000-000000000008', 'kanokwan.s@example.com', NULL, NULL, 'กรุงเทพมหานคร', 'members');

INSERT INTO employment (alumni_id, organization, position, job_category, sector, salary_band, start_month, is_current, is_related_to_major) VALUES
('00000000-0000-4000-8000-000000000001', 'บริษัทเทคโนโลยีแห่งหนึ่ง', 'Software Engineer', 'ไอที/ซอฟต์แวร์', 'เอกชน', '30,001–40,000', '2021-06-01', true, true),
('00000000-0000-4000-8000-000000000002', 'การไฟฟ้าส่วนภูมิภาค', 'วิศวกรควบคุมระบบ', 'ราชการ/รัฐวิสาหกิจ', 'รัฐวิสาหกิจ', '20,001–30,000', '2023-08-01', true, true),
('00000000-0000-4000-8000-000000000003', 'โรงงานแปรรูปเกษตร', 'หัวหน้าฝ่ายซ่อมบำรุง', 'วิศวกร', 'เอกชน', '40,001–50,000', '2020-01-01', true, true),
('00000000-0000-4000-8000-000000000004', 'บริษัทโลจิสติกส์', 'นักวางแผนขนส่ง', 'วิศวกร', 'เอกชน', '20,001–30,000', '2025-07-01', true, true),
('00000000-0000-4000-8000-000000000005', 'บริษัทซอฟต์แวร์ในภาคอีสาน', 'ผู้ก่อตั้งและกรรมการผู้จัดการ', 'ประกอบกิจการเอง', 'ประกอบกิจการเอง', NULL, '2015-01-01', true, true),
('00000000-0000-4000-8000-000000000006', 'โครงการพลังงานหมุนเวียน', 'วิศวกรระบบไฟฟ้าอาวุโส', 'วิศวกร', 'เอกชน', NULL, '2017-03-01', true, true),
('00000000-0000-4000-8000-000000000007', 'โรงงานอุตสาหกรรมเกษตร', 'ผู้จัดการโรงงาน', 'วิศวกร', 'เอกชน', NULL, '2019-05-01', true, true),
('00000000-0000-4000-8000-000000000008', 'บริษัทขนส่งระหว่างประเทศ', 'ผู้เชี่ยวชาญการวางแผนขนส่ง', 'วิศวกร', 'เอกชน', NULL, '2022-02-01', true, true);

INSERT INTO alumni_skill (alumni_id, skill_id)
SELECT a.id, s.id FROM (VALUES
  ('00000000-0000-4000-8000-000000000001', 'TypeScript'), ('00000000-0000-4000-8000-000000000001', 'ระบบฝังตัว'), ('00000000-0000-4000-8000-000000000001', 'Cloud'),
  ('00000000-0000-4000-8000-000000000002', 'ระบบไฟฟ้ากำลัง'), ('00000000-0000-4000-8000-000000000002', 'PLC'),
  ('00000000-0000-4000-8000-000000000003', 'งานซ่อมบำรุง'), ('00000000-0000-4000-8000-000000000003', 'ความปลอดภัยในโรงงาน'),
  ('00000000-0000-4000-8000-000000000004', 'การวางแผนขนส่ง'), ('00000000-0000-4000-8000-000000000004', 'การวิเคราะห์ข้อมูล'),
  ('00000000-0000-4000-8000-000000000005', 'ระบบฝังตัว'), ('00000000-0000-4000-8000-000000000005', 'การบริหารโครงการ'),
  ('00000000-0000-4000-8000-000000000006', 'พลังงานหมุนเวียน'), ('00000000-0000-4000-8000-000000000006', 'ระบบไฟฟ้ากำลัง'),
  ('00000000-0000-4000-8000-000000000007', 'ยานยนต์'), ('00000000-0000-4000-8000-000000000007', 'การบริหารการผลิต'), ('00000000-0000-4000-8000-000000000007', 'สหกิจศึกษา'),
  ('00000000-0000-4000-8000-000000000008', 'การวางแผนขนส่ง'), ('00000000-0000-4000-8000-000000000008', 'พี่เลี้ยงอาชีพ'), ('00000000-0000-4000-8000-000000000008', 'CNC')
) AS v(alumni_id, skill_name)
JOIN alumni a ON a.id = v.alumni_id::uuid
JOIN skill s ON s.name = v.skill_name;

INSERT INTO consent_log (alumni_id, purpose, granted, policy_version, recorded_at)
SELECT id, p.purpose, true, '2569-10-30', claimed_at
FROM alumni, (VALUES ('data_processing'::consent_purpose), ('directory_listing'), ('news')) AS p(purpose)
WHERE claim_status = 'verified';

INSERT INTO alumni_post (author_id, type, title, body, visibility, moderation_status, moderated_by, moderated_at, is_pinned, published_at) VALUES
('00000000-0000-4000-8000-000000000001', 'ความก้าวหน้าในอาชีพ', 'ได้รับตำแหน่งหัวหน้าทีมพัฒนาระบบ',
 'ขอบคุณพื้นฐานจากคณะที่ทำให้ผมมาถึงวันนี้ครับ ใครสนใจงานสายซอฟต์แวร์ที่ขอนแก่น ทักมาได้เลย', 'public', 'approved', 'staff', now() - interval '2 days', false, now() - interval '2 days'),
('00000000-0000-4000-8000-000000000006', 'รางวัล/ความสำเร็จ', 'ได้รับรางวัลวิศวกรดีเด่นระดับภูมิภาค ประจำปี 2569',
 'ขอมอบรางวัลนี้ให้คณาจารย์ทุกท่านที่สอนมาค่ะ', 'public', 'approved', 'staff', now() - interval '5 days', true, now() - interval '5 days'),
('00000000-0000-4000-8000-000000000007', 'กิจกรรมรุ่น', 'นัดรวมรุ่นช่างยนต์ 2545 ครบรอบ 24 ปี',
 'เปิดรับลงชื่อเข้าร่วมแล้ว ใครติดต่อเพื่อนในรุ่นไม่ได้ ลองค้นในทำเนียบศิษย์เก่าได้เลย', 'members', 'approved', 'staff', now() - interval '8 days', false, now() - interval '8 days'),
('00000000-0000-4000-8000-000000000005', 'ธุรกิจ/ผลงานใหม่', 'เปิดรับนักศึกษาสหกิจศึกษา 12 อัตรา',
 'บริษัทเปิดรับรุ่นน้องเข้าฝึกสหกิจในสายพัฒนาระบบและระบบฝังตัว', 'public', 'approved', 'staff', now() - interval '13 days', false, now() - interval '13 days'),
('00000000-0000-4000-8000-000000000004', 'ความก้าวหน้าในอาชีพ', 'ย้ายไปทำงานสายวางแผนระบบขนส่งระหว่างประเทศ',
 'ยังรอการตรวจสอบจากเจ้าหน้าที่', 'members', 'pending', NULL, NULL, false, NULL);

INSERT INTO event (title, starts_at, ends_at, venue, is_online, registration_open, capacity) VALUES
('คืนสู่เหย้า ชาววิศวฯ กาฬสินธุ์ 2569', '2026-11-14 17:00+07', '2026-11-14 22:00+07', 'ลานกิจกรรมคณะวิศวกรรมศาสตร์', false, true, 300),
('เปิดบ้านอาชีพ: เส้นทางวิศวกรรุ่นพี่', '2026-11-28 09:00+07', '2026-11-28 12:00+07', 'ห้องประชุมคณะวิศวกรรมศาสตร์', false, true, 120),
('Job Fair ศิษย์เก่าพบรุ่นน้อง', '2026-12-09 09:30+07', '2026-12-09 16:00+07', 'อาคารเรียนรวม มหาวิทยาลัยกาฬสินธุ์', false, true, NULL),
('อบรมทักษะ AI สำหรับวิศวกร (ศิษย์เก่าเรียนฟรี)', '2027-01-23 13:00+07', '2027-01-23 16:00+07', 'ออนไลน์ผ่านระบบประชุมทางไกล', true, false, 200);

INSERT INTO job_post (posted_by, title, organization, employment_type, location, closes_at, moderation_status) VALUES
('00000000-0000-4000-8000-000000000001', 'Software Engineer (Backend)', 'บริษัทเทคโนโลยีแห่งหนึ่ง', 'งานประจำ', 'ขอนแก่น', '2026-11-30', 'approved'),
('00000000-0000-4000-8000-000000000005', 'นักศึกษาสหกิจศึกษา — ระบบฝังตัว', 'บริษัทซอฟต์แวร์ในภาคอีสาน', 'สหกิจศึกษา', 'กาฬสินธุ์', '2026-10-31', 'approved'),
('00000000-0000-4000-8000-000000000008', 'ผู้ช่วยวิศวกรวางแผนขนส่ง (ฝึกงาน)', 'บริษัทขนส่งระหว่างประเทศ', 'ฝึกงาน', 'กรุงเทพมหานคร', '2026-12-15', 'approved');

INSERT INTO news (title, summary, category, published_at, created_by) VALUES
('เปิดรับสมัครทุนการศึกษาจากศิษย์เก่า ประจำปี 2570', 'สำหรับนักศึกษาชั้นปีที่ 2–4 ที่มีผลการเรียนดีและขาดแคลนทุนทรัพย์ จำนวน 20 ทุน', 'ทุนการศึกษา', '2026-09-18+07', 'staff'),
('ขอเชิญเสนอชื่อศิษย์เก่าดีเด่น ประจำปี 2570', 'เปิดรับการเสนอชื่อจากศิษย์เก่าทุกรุ่น ถึงวันที่ 31 ตุลาคม 2569', 'ศิษย์เก่าดีเด่น', '2026-09-02+07', 'staff'),
('ขอความร่วมมือศิษย์เก่าตอบแบบสำรวจภาวะการมีงานทำ', 'ใช้เวลาประมาณ 5 นาที ข้อมูลใช้เพื่อปรับปรุงหลักสูตรและรายงานประกันคุณภาพ', 'แบบสำรวจ', '2026-08-25+07', 'staff');
