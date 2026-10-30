-- ============================================================
-- Programme taxonomy for the Faculty of Engineering and Industrial
-- Technology, Kalasin University — with lineage and provenance.
--
-- Sources (checked 2026-10-30):
--   [A] student-admis.ksu.ac.th/portal/programs/levels/{1,2,3}  (รอบรับสมัคร 2570)
--   [B] th.ksu.ac.th/หลักสูตร-ปวส
--   [C] th.wikipedia.org — คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มกส. (แก้ไข 17 พ.ย. 2567)
--   [D] admissionpremium.com/content/5882  (snapshot ปีการศึกษา 2564)
--   [E] kalasin.top — overview page
--   [F] ie.eng.ksu.ac.th (via search snippet; site refused direct connection)
--   [U] reported by faculty staff in conversation — NOT yet confirmed with registrar
--
-- `verified` stays false everywhere until the registrar export is reconciled.
-- ============================================================

-- ---------- ปวส. ----------
INSERT INTO program (code, name_th, name_en, degree_level, study_plan, status, valid_from_year, valid_to_year, source, source_note, sort_order) VALUES
('hvc-machine',    'ช่างกลโรงงาน',                               'Machine Tool Technology',            'ปวส.', '2ปี', 'active', NULL, NULL, 'web_official',  '[A][B][C][D]',                                   10),
('hvc-auto-legacy','ช่างยนต์',                                    'Automotive Mechanics',               'ปวส.', '2ปี', 'renamed', NULL, NULL, 'user_reported', '[U] ยุค มทร.อีสาน วิทยาเขตกาฬสินธุ์ ก่อน พ.ศ. 2558', 20),
('hvc-auto-tech',  'เทคนิคยานยนต์',                              'Automotive Technology',              'ปวส.', '2ปี', 'active', NULL, NULL, 'web_official',  '[A] 2570; [B] ใช้ชื่อ "เทคนิคเครื่องกล"; [C] ใช้ "เทคนิคยานยนต์"', 21),
('hvc-elec',       'ไฟฟ้ากำลัง',                                 'Electrical Power',                   'ปวส.', '2ปี', 'active', NULL, NULL, 'web_official',  '[A][C][D][E]',                                   30),
('hvc-comp-auto',  'เทคโนโลยีคอมพิวเตอร์และระบบอัตโนมัติ',         'Computer Technology and Automation', 'ปวส.', '2ปี', 'renamed', NULL, 2566, 'web_secondary', '[D] ชื่อในรอบรับสมัคร 2564',                     40),
('hvc-comp',       'เทคโนโลยีคอมพิวเตอร์',                        'Computer Technology',                'ปวส.', '2ปี', 'active', NULL, NULL, 'web_secondary', '[C]; ไม่ปรากฏใน [A] 2570 — ตรวจสอบสถานะ',       41),
('hvc-logistics',  'เทคโนโลยีโลจิสติกส์และการขนส่ง',              'Logistics and Transport Technology', 'ปวส.', '2ปี', 'active', NULL, NULL, 'web_secondary', '[C][D]; ไม่ปรากฏใน [A] 2570 — ตรวจสอบสถานะ',    50),
('hvc-agri-mech',  'เครื่องกลเกษตร',                              'Agricultural Machinery',             'ปวส.', '2ปี', 'active', NULL, NULL, 'web_secondary', '[C]',                                            60);

-- ---------- อส.บ. / ทล.บ. ----------
INSERT INTO program (code, name_th, name_en, degree_level, study_plan, status, valid_from_year, valid_to_year, source, source_note, sort_order) VALUES
('bit-ie-legacy',  'เทคโนโลยีอุตสาหการ',                         'Industrial Technology',              'อส.บ.', 'ต่อเนื่อง', 'renamed', NULL, NULL, 'user_reported', '[U] ยุค มทร.อีสาน',                              110),
('bit-ie',         'วิศวกรรมอุตสาหการ (ต่อเนื่อง)',               'Industrial Engineering (Continuing)','อส.บ.', 'ต่อเนื่อง', 'active', NULL, NULL, 'web_official',  '[F] 2 ปีต่อเนื่อง รับผู้จบ ปวส.',               111),
('bit-me-legacy',  'เทคโนโลยีเครื่องกล',                         'Mechanical Technology',              'อส.บ.', 'ต่อเนื่อง', 'renamed', NULL, NULL, 'user_reported', '[U] ยุค มทร.อีสาน',                              120),
('btech-me',       'เทคโนโลยีวิศวกรรมเครื่องกล',                  'Mechanical Engineering Technology',  'ทล.บ.', 'ต่อเนื่อง', 'closed', NULL, NULL, 'web_secondary', '[D] 2564; ไม่ปรากฏใน [A] 2570',                 121),
('bit-agri',       'วิศวกรรมเครื่องจักรกลเกษตร',                  'Agricultural Machinery Engineering', 'อส.บ.', '4ปี',      'active', NULL, NULL, 'web_secondary', '[C][E]',                                         130),
('bit-agri-cont',  'วิศวกรรมเครื่องจักรกลเกษตร (ต่อเนื่อง)',      'Agricultural Machinery Engineering (Continuing)', 'อส.บ.', 'ต่อเนื่อง', 'active', NULL, NULL, 'web_secondary', '[C] 2 ปี เทียบโอน', 131);

-- ---------- วศ.บ. 4 ปี ----------
INSERT INTO program (code, name_th, name_en, degree_level, study_plan, status, valid_from_year, valid_to_year, source, source_note, sort_order) VALUES
('beng-cpe-auto',  'วิศวกรรมคอมพิวเตอร์และระบบอัตโนมัติ',          'Computer and Automation Engineering','วศ.บ.', '4ปี', 'renamed', NULL, 2566, 'web_secondary', '[D] 2564',                                       200),
('beng-cpe',       'วิศวกรรมคอมพิวเตอร์',                         'Computer Engineering',               'วศ.บ.', '4ปี', 'active', NULL, NULL, 'web_official',  '[A][C][E]',                                      201),
('beng-ie-auto',   'วิศวกรรมอุตสาหการและระบบอัตโนมัติ',            'Industrial and Automation Engineering','วศ.บ.', '4ปี', 'renamed', NULL, 2566, 'web_secondary', '[D] 2564',                                     210),
('beng-ie',        'วิศวกรรมอุตสาหการ',                            'Industrial Engineering',             'วศ.บ.', '4ปี', 'active', NULL, NULL, 'web_official',  '[A][C][E][F]',                                   211),
('beng-me',        'วิศวกรรมเครื่องกล',                            'Mechanical Engineering',             'วศ.บ.', '4ปี', 'active', NULL, NULL, 'web_official',  '[A][C][D][E]',                                   220),
('beng-mecha',     'วิศวกรรมเมคคาทรอนิกส์',                        'Mechatronics Engineering',           'วศ.บ.', '4ปี', 'active', NULL, NULL, 'web_official',  '[A][C][D][E]',                                   230),
('beng-logi',      'วิศวกรรมโลจิสติกส์',                           'Logistics Engineering',              'วศ.บ.', '4ปี', 'active', NULL, NULL, 'web_official',  '[A][C][D]; [E] ใช้ชื่อ "โลจิสติกส์และเทคโนโลยีขนส่ง"', 240),
('beng-ee',        'วิศวกรรมไฟฟ้า',                                'Electrical Engineering',             'วศ.บ.', '4ปี', 'active', NULL, NULL, 'web_official',  '[A] ระดับเทียบโอน 2570; [E]',                    250),
('beng-ai',        'วิศวกรรมปัญญาประดิษฐ์และระบบอัจฉริยะ',          'AI and Intelligent Systems Engineering','วศ.บ.', '4ปี', 'active', 2570, NULL, 'web_official', '[A] เปิดรับครั้งแรก 2570',                      260),
('beng-agri-mech', 'วิศวกรรมเครื่องจักรกลเกษตร',                   'Agricultural Machinery Engineering', 'วศ.บ.', '4ปี', 'renamed', NULL, 2566, 'web_secondary', '[D] 2564 ระบุเป็น วศ.บ.; ปัจจุบันเป็น อส.บ. ตาม [C]', 270);

-- ---------- วศ.บ. เทียบโอน ----------
INSERT INTO program (code, name_th, name_en, degree_level, study_plan, status, source, source_note, sort_order) VALUES
('beng-cpe-tr',   'วิศวกรรมคอมพิวเตอร์ (เทียบโอน)',    'Computer Engineering (Transfer)',    'วศ.บ.', 'เทียบโอน', 'active', 'web_official', '[A] level 3; [C] 2 ปี', 301),
('beng-ie-tr',    'วิศวกรรมอุตสาหการ (เทียบโอน)',       'Industrial Engineering (Transfer)',  'วศ.บ.', 'เทียบโอน', 'active', 'web_official', '[A] level 3; [C] 3 ปี', 311),
('beng-me-tr',    'วิศวกรรมเครื่องกล (เทียบโอน)',       'Mechanical Engineering (Transfer)',  'วศ.บ.', 'เทียบโอน', 'active', 'web_official', '[A] level 3; [C] 3 ปี', 321),
('beng-mecha-tr', 'วิศวกรรมเมคคาทรอนิกส์ (เทียบโอน)',   'Mechatronics Engineering (Transfer)','วศ.บ.', 'เทียบโอน', 'active', 'web_official', '[A] level 3; [C] 3 ปี', 331),
('beng-logi-tr',  'วิศวกรรมโลจิสติกส์ (เทียบโอน)',      'Logistics Engineering (Transfer)',   'วศ.บ.', 'เทียบโอน', 'active', 'web_official', '[A] level 3; [C] 3 ปี', 341),
('beng-ee-tr',    'วิศวกรรมไฟฟ้า (เทียบโอน)',           'Electrical Engineering (Transfer)',  'วศ.บ.', 'เทียบโอน', 'active', 'web_official', '[A] level 3',           351);

-- ---------- สถ.บ. ----------
INSERT INTO program (code, name_th, name_en, degree_level, study_plan, status, source, source_note, sort_order) VALUES
('barch-design',    'นวัตกรรมการออกแบบ',             'Design Innovation',            'สถ.บ.', '4ปี',      'active', 'web_official', '[A][C]; [E] ใช้ชื่อ "นวัตกรรมการออกแบบและสถาปัตยกรรม"', 400),
('barch-design-tr', 'นวัตกรรมการออกแบบ (เทียบโอน)',  'Design Innovation (Transfer)', 'สถ.บ.', 'เทียบโอน', 'active', 'web_official', '[A] level 3; [C] 3 ปี', 401);

-- ---------- lineage ----------
UPDATE program SET successor_id = (SELECT id FROM program WHERE code = 'hvc-auto-tech') WHERE code = 'hvc-auto-legacy';
UPDATE program SET successor_id = (SELECT id FROM program WHERE code = 'hvc-comp')      WHERE code = 'hvc-comp-auto';
UPDATE program SET successor_id = (SELECT id FROM program WHERE code = 'bit-ie')        WHERE code = 'bit-ie-legacy';
UPDATE program SET successor_id = (SELECT id FROM program WHERE code = 'btech-me')      WHERE code = 'bit-me-legacy';
UPDATE program SET successor_id = (SELECT id FROM program WHERE code = 'beng-cpe')      WHERE code = 'beng-cpe-auto';
UPDATE program SET successor_id = (SELECT id FROM program WHERE code = 'beng-ie')       WHERE code = 'beng-ie-auto';
UPDATE program SET successor_id = (SELECT id FROM program WHERE code = 'bit-agri')      WHERE code = 'beng-agri-mech';

-- ---------- skills (shared vocabulary) ----------
INSERT INTO skill (name) VALUES
('TypeScript'), ('ระบบฝังตัว'), ('Cloud'), ('ระบบไฟฟ้ากำลัง'), ('PLC'), ('งานซ่อมบำรุง'),
('ความปลอดภัยในโรงงาน'), ('การวางแผนขนส่ง'), ('การวิเคราะห์ข้อมูล'), ('การบริหารโครงการ'),
('พลังงานหมุนเวียน'), ('การบริหารการผลิต'), ('สหกิจศึกษา'), ('พี่เลี้ยงอาชีพ'), ('CNC'), ('งานเชื่อม'), ('ยานยนต์');
