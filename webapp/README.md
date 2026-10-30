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

ไฟล์ใน `db/` รันอัตโนมัติ**เฉพาะตอน volume ว่าง** ถ้ามีไฟล์ migration ใหม่ ให้รันเอง:

```bash
docker exec -i ksu-alumni-db psql -U alumni -d alumni < db/004_admin.sql
```

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
src/
  app/
    (site)/              หน้าเว็บสาธารณะ (อ่านข้อความ/รูป/ข่าวจากฐานข้อมูล)
    admin/               หลังบ้าน — login, ภาพรวม, สมาชิก, ข่าว, ข้อมูลเว็บ
    api/                 programs, upload, register, files/[id]
  components/            คอมโพเนนต์ UI (admin/ สำหรับหลังบ้าน)
  lib/
    registration.ts      กฎตรวจฟอร์มสมัคร (ใช้ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์)
    server/              db, storage (MinIO), files, auth, content, members, client-ip
  middleware.ts          ด่านแรกของ /admin
```

## การเชื่อมโยงกับเอกสารออกแบบ
โค้ดอ้างอิงรหัสความต้องการจาก `../03-Design/SRS.md` ไว้ในคอมเมนต์ เช่น `FR-ADM-20`
(บันทึก log ทุกครั้งที่เปิดดูข้อมูลสมาชิก) — ดูภาพรวมที่ `03-Design/Admin Back Office.md`
และ `03-Design/Database Design.md`
