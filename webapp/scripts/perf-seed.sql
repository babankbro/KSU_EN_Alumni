-- NFR-PERF-02 load test data: 20,000 fictional verified alumni with
-- contact, consent, current job, skills and some former names.
-- Run ONLY against a throwaway copy (e.g. database alumni_perf), never the
-- live database:
--   docker exec -i ksu-alumni-db psql -U alumni -d alumni_perf < scripts/perf-seed.sql
\set n 20000
BEGIN;
CREATE TEMP TABLE names AS SELECT
  ARRAY['สมชาย','สมศักดิ์','วิชัย','ประเสริฐ','อนุชา','ธนพล','กิตติพงษ์','ณัฐวุฒิ','ศุภชัย','วีระ','สุดารัตน์','วรรณา','ศิริพร','กนกวรรณ','พิมพ์ชนก','นลิน','อรอุมา','จิราพร','ปิยะนุช','มาลี'] AS first,
  ARRAY['ใจดี','แก้วใส','มั่นคง','ทองมี','ศรีสุข','ภูผา','บุญมา','พรมมา','ดีงาม','สายทอง','คำแก้ว','ชัยมงคล','อินทร์แก้ว','ศรีวงศ์','จันทร์หอม','พลเยี่ยม','บุตรดี','วงศ์ใหญ่','นาคสุข','แสงทอง'] AS last,
  ARRAY['กาฬสินธุ์','ขอนแก่น','มหาสารคาม','ร้อยเอ็ด','อุดรธานี','กรุงเทพมหานคร','ชลบุรี','ระยอง','นครราชสีมา','สกลนคร'] AS prov,
  ARRAY['วิศวกร','ไอที/ซอฟต์แวร์','ราชการ/รัฐวิสาหกิจ','ประกอบกิจการเอง','การศึกษา/วิจัย','ช่างเทคนิค'] AS cat;

INSERT INTO alumni (title_th, first_name_th, last_name_th, nickname, program_id, admission_year, graduation_year,
                    claim_status, claimed_at, profile_updated_at, completeness_score)
SELECT CASE WHEN g % 2 = 0 THEN 'นาย' ELSE 'นางสาว' END,
       n.first[1 + (g * 7) % 20] || CASE WHEN g % 3 = 0 THEN '' ELSE chr(3585 + g % 40) END,
       n.last[1 + (g * 13) % 20] || chr(3585 + (g / 40) % 40),
       NULL,
       (SELECT id FROM program ORDER BY id OFFSET (g % 32) LIMIT 1),
       2540 + g % 29, 2544 + g % 29, 'verified', now(),
       now() - make_interval(days => g % 900), 60 + g % 40
FROM generate_series(1, :n) g, names n;

CREATE TEMP TABLE fake AS SELECT id, row_number() OVER (ORDER BY id) AS g FROM alumni WHERE nickname IS NULL AND claimed_at > now() - interval '1 hour';

INSERT INTO alumni_contact (alumni_id, email, phone, province, visibility, field_visibility)
SELECT f.id, 'perf' || f.g || '@example.invalid', '08' || lpad((f.g * 7919 % 100000000)::text, 8, '0'),
       n.prov[1 + f.g % 10], (ARRAY['public','members','private'])[1 + f.g % 3]::visibility, '{}'::jsonb
FROM fake f, names n;

INSERT INTO consent_log (alumni_id, purpose, granted, policy_version)
SELECT id, p, true, 'perf' FROM fake, unnest(ARRAY['data_processing','directory_listing']::consent_purpose[]) p;

INSERT INTO employment (alumni_id, organization, position, job_category, sector, is_current)
SELECT f.id, 'บริษัททดสอบ ' || (f.g % 500), 'ตำแหน่ง ' || (f.g % 50), n.cat[1 + f.g % 6],
       (ARRAY['รัฐ','รัฐวิสาหกิจ','เอกชน','ประกอบกิจการเอง','อื่นๆ'])[1 + f.g % 5]::employment_sector, true
FROM fake f, names n;

INSERT INTO alumni_skill (alumni_id, skill_id)
SELECT f.id, s.id FROM fake f JOIN skill s ON s.id % 7 IN (f.g % 7, (f.g + 3) % 7) ON CONFLICT DO NOTHING;

INSERT INTO alumni_former_name (alumni_id, first_name_th, last_name_th)
SELECT f.id, a.first_name_th, n.last[1 + f.g % 20] FROM fake f JOIN alumni a ON a.id = f.id, names n WHERE f.g % 10 = 0;

ANALYZE;
SELECT 'listed in directory', count(*) FROM directory_public;
COMMIT;
