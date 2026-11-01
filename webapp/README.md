# KSU Engineering Alumni — Web Application (draft)

ระบบสารสนเทศศิษย์เก่า คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยกาฬสินธุ์

> ⚠️ ข้อมูลศิษย์เก่าใน `db/003_seed_sample.sql` เป็น **บุคคลสมมติทั้งหมด** — ลบออกก่อนใช้งานจริง

## Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- **PostgreSQL 16** — ข้อมูลทั้งหมด (`db/*.sql`)
- **MinIO** — รูปและไฟล์ PDF ใน bucket ส่วนตัว
- CSS ธรรมดาพร้อม design token ตาม `03-Design/Visual Design.md` (ไม่พึ่ง UI framework — ลดภาระการดูแลระยะยาว)
- ฟอนต์ self-host จาก `@fontsource` — build ได้แม้ไม่มีอินเทอร์เน็ต

## รันทั้งระบบด้วย Docker

```bash
cp .env.example .env
```

แก้ `.env` อย่างน้อยหนึ่งค่า:

```
ADMIN_BOOTSTRAP_PASSWORD=<รหัสผ่านอย่างน้อย 12 ตัวอักษร>
```

`.env.example` เว้นค่านี้ว่างไว้โดยตั้งใจ — ถ้าว่าง ระบบจะไม่สร้างบัญชีผู้ดูแล และจะเข้า `/admin` ไม่ได้
บัญชีนี้ถูกสร้าง**ครั้งเดียว**ตอนยังไม่มีบัญชีใดเลย หลังจากนั้นค่านี้ไม่มีผล

```bash
docker compose up --build
```

| บริการ | URL (ค่าเริ่มต้น) |
|---|---|
| เว็บ | http://localhost:3000 (`WEB_PORT`) |
| สมัครสมาชิก | `/register` |
| **หลังบ้าน** | `/admin` — อีเมล `ADMIN_BOOTSTRAP_EMAIL` |
| MinIO console | http://localhost:9001 (`MINIO_CONSOLE_PORT`) |
| PostgreSQL | `localhost:5432` (`POSTGRES_PORT`) |

ถ้าพอร์ตชนกับโปรแกรมอื่นในเครื่อง ให้เปลี่ยนค่าใน `.env`

### ค่าที่ต้องคิดก่อนใช้งานจริง

| ตัวแปร | ความหมาย |
|---|---|
| `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD` | ค่าใน `.env.example` ใช้ได้เฉพาะเครื่องพัฒนา |
| `COOKIE_SECURE=true` | เมื่อเว็บให้บริการผ่าน HTTPS |
| `TRUST_PROXY=true` | **เฉพาะ**เมื่ออยู่หลัง reverse proxy ที่ตั้ง `X-Forwarded-For` ถูกต้อง — ภายใน Docker เปล่า ๆ ทุก request มาจาก IP เดียวกัน ถ้าเปิดค่านี้ผิดที่ การล็อกตาม IP จะล็อกเจ้าหน้าที่ทุกคน |
| `POLICY_VERSION` | เปลี่ยนทุกครั้งที่แก้นโยบายความเป็นส่วนตัว — บันทึกไว้กับทุกความยินยอม |

### อัปเดตฐานข้อมูลที่มีอยู่แล้ว

ไฟล์ใน `db/` รันอัตโนมัติ**เฉพาะตอน volume ว่าง** ถ้ามีไฟล์ migration ใหม่ ให้รันเองตามลำดับ (ทุกไฟล์ตั้งแต่ `004` รันซ้ำได้):

```bash
docker exec -i ksu-alumni-db psql -v ON_ERROR_STOP=1 -U alumni -d alumni < db/005_remaining_srs.sql
```

```bash
docker exec -i ksu-alumni-db psql -v ON_ERROR_STOP=1 -U alumni -d alumni < db/006_posts_events_jobs.sql
```

| บริการเสริมใน compose | หน้าที่ |
|---|---|
| `cron` | เรียก `/api/internal/cron` ทุก 60 วินาที — ส่งอีเมล/LINE เตือนก่อนวันงาน จับคู่ประกาศงาน สรุปรายสัปดาห์ |
| `mailpit` | กล่องอีเมลสำหรับเครื่องพัฒนา ดูได้ที่ http://localhost:8025 — ใช้จริงให้ตั้ง `SMTP_*` |

LINE Login และการส่งทาง LINE ทำงานเมื่อตั้ง `LINE_*` ใน `.env` เท่านั้น (ยังไม่ได้ทดสอบกับ channel จริง)

## Production — https://alumni.iaaaiksu.com

รันบนเซิร์ฟเวอร์ `brain-prod` (187.127.98.12) ซึ่งใช้ร่วมกับโปรเจ็คอื่น — host nginx รับโดเมนแล้ว proxy ไปที่ `127.0.0.1:3200`
ส่วน db / minio ไม่เปิดพอร์ตออกนอก compose network (ดู `docker-compose.prod.yml`)

| รายการ | ที่อยู่บนเซิร์ฟเวอร์ |
|---|---|
| โค้ด | `/root/ksu-alumni` (clone จาก GitHub) |
| ค่าลับ | `/root/ksu-alumni/webapp/.env` — ไม่อยู่ใน git |
| nginx | `/etc/nginx/sites-available/alumni.iaaaiksu.com` (ต้นฉบับ `deploy/nginx/`) |
| อีเมลที่ระบบส่ง | Mailpit — `ssh -L 8025:127.0.0.1:8026 brain-prod` แล้วเปิด http://localhost:8025 |

`.env` บนเซิร์ฟเวอร์ต่างจาก `.env.example` ตรงที่ `COOKIE_SECURE=true`, `TRUST_PROXY=true`, `APP_URL=https://alumni.iaaaiksu.com`, `WEB_PORT=3200`
และรหัสผ่าน/secret ทุกตัวสุ่มใหม่ (`openssl rand -hex 24`)

อัปเดตเว็บหลัง `git push`:

```bash
ssh brain-prod "cd /root/ksu-alumni && git pull && cd webapp && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
```

ถ้ามีไฟล์ migration ใหม่ใน `db/` ให้รันตามหัวข้อ "อัปเดตฐานข้อมูลที่มีอยู่แล้ว" ด้านบน (ผ่าน `ssh brain-prod`)

## การสำรองข้อมูล (NFR-SEC-05)

บริการ `backup` และ `backup-files` ใน compose ทำงานเองทุก `BACKUP_INTERVAL_HOURS` (ค่าเริ่มต้น 24 ชั่วโมง) และทำรอบแรกทันทีที่เริ่ม

| ที่เก็บ | เนื้อหา |
|---|---|
| `backups/db/alumni-<เวลา UTC>.dump` | `pg_dump` แบบ custom format ตรวจว่าอ่านกลับได้ก่อนเก็บ เก็บไว้ `BACKUP_KEEP` ไฟล์ล่าสุด (ค่าเริ่มต้น 14) |
| `backups/db/latest.txt` | ชื่อไฟล์ล่าสุดที่ผ่านการตรวจ |
| `backups/files/` | สำเนาไฟล์ใน MinIO (รูป PDF) ให้ตรงกับ bucket ปัจจุบัน |

**โฟลเดอร์ `backups/` มีข้อมูลส่วนบุคคล** — ถูก gitignore แล้ว และควรคัดลอกไปเก็บนอกเครื่องนี้ (เช่น ไดรฟ์ของคณะ) อย่างน้อยสัปดาห์ละครั้ง ไม่เช่นนั้นถ้าเครื่องเสีย สำรองก็หายไปด้วย

ทดสอบกู้คืน (กู้ลงฐานข้อมูลชั่วคราวแล้วเทียบจำนวนแถวกับฐานจริง ไม่แตะฐานจริง):

```bash
sh scripts/restore-test.sh
```

กู้คืนจริงเมื่อฐานข้อมูลเสียหาย (ลบข้อมูลปัจจุบันทั้งหมด — หยุดเว็บก่อน):

```bash
docker compose stop web cron
docker exec -i ksu-alumni-db psql -U alumni -d postgres -c "DROP DATABASE alumni" -c "CREATE DATABASE alumni"
docker exec -i ksu-alumni-db pg_restore --no-owner -U alumni -d alumni < backups/db/<ไฟล์>.dump
docker compose start web cron
```

กู้ไฟล์คืนเข้า MinIO: `docker exec ksu-alumni-backup-files mc mirror /backups/files/alumni-files src/alumni-files`

## วัดความเร็วทำเนียบ (NFR-PERF-02)

`scripts/perf-seed.sql` สร้างศิษย์เก่าสมมติ 20,000 คน — **รันกับฐานข้อมูลสำเนาเท่านั้น** แล้วใช้ `scripts/perf-directory.sh` วัดเวลาตอบของหน้าทำเนียบผ่าน HTTP คำสั่งใช้งานอยู่ในหัวของทั้งสองไฟล์

## รันแบบพัฒนา (ไม่ build image)

ใช้ db + minio จาก compose แล้วรันเว็บบนเครื่อง:

```bash
docker compose up -d db minio
npm install
npm run dev
```

ค่าเชื่อมต่อสำหรับโหมดนี้อยู่ใน `.env.local` (ดูตัวอย่างท้าย `.env.example`)

## โครงสร้าง
```
db/
  001_schema.sql         ตาราง view trigger
  002_seed_programs.sql  หลักสูตรทุกระดับ พร้อมประวัติการเปลี่ยนชื่อ
  003_seed_sample.sql    ศิษย์เก่าตัวอย่าง (สมมติ)
  004_admin.sql          บัญชีเจ้าหน้าที่ ข้อความ/รูปบนเว็บ
  005_remaining_srs.sql  บัญชีสมาชิก ข่าวศิษย์เก่า กิจกรรม งาน บทความ รางวัล แบบสำรวจ แจ้งเตือน PDPA
  006_posts_events_jobs.sql  ส่วนเพิ่มเติมระหว่างพัฒนา
src/
  app/
    (site)/              หน้าเว็บสาธารณะ + /me (พื้นที่สมาชิก) + /survey/employer (ลิงก์นายจ้าง)
    admin/               หลังบ้าน — สมาชิก ตรวจสอบเนื้อหา ข่าว กิจกรรม แกลเลอรี รางวัล แบบสำรวจ
                         ส่งประกาศ PDPA นำเข้า ระเบียนซ้ำ ข้อมูลอ้างอิง บัญชีเจ้าหน้าที่
    api/                 register, files/[id], alumni-lookup, auth/line, internal/cron
  components/            คอมโพเนนต์ UI (admin/ หลังบ้าน, forms/ ฟอร์มกลาง, me/ พื้นที่สมาชิก)
  lib/
    registration.ts      กฎตรวจฟอร์มสมัคร (ใช้ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์)
    surveys.ts           โมเดลคำถามแบบสำรวจ (ใช้ทั้งสองฝั่ง)
    server/              db, storage, files, auth, member-auth, posts, events, jobs, kb, awards,
                         surveys, notify, cron, directory, profile, data-admin, rate-limit ฯลฯ
  middleware.ts          ด่านแรกของ /admin
```

## การเชื่อมโยงกับเอกสารออกแบบ
โค้ดอ้างอิงรหัสความต้องการจาก `../03-Design/SRS.md` ไว้ในคอมเมนต์ เช่น `FR-ADM-20`
(บันทึก log ทุกครั้งที่เปิดดูข้อมูลสมาชิก) — ดูภาพรวมที่ `03-Design/Admin Back Office.md`
และ `03-Design/Database Design.md`
