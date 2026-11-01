# เอกสารติดตั้ง — ระบบศิษย์เก่าคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม ม.กาฬสินธุ์

สำหรับผู้ดูแลเซิร์ฟเวอร์ (NFR-MNT-01) · คู่มืออื่น: [ADMIN-GUIDE.md](ADMIN-GUIDE.md) (เจ้าหน้าที่) · [USER-GUIDE.md](USER-GUIDE.md) (ศิษย์เก่า/นักศึกษา)

## 1. ส่วนประกอบ

| บริการ (docker compose) | หน้าที่ |
|---|---|
| `web` | เว็บไซต์และหลังบ้าน (Next.js) พอร์ต 3000 ใน container |
| `db` | PostgreSQL 16 — ข้อมูลทั้งหมด |
| `minio` | ที่เก็บไฟล์ (รูป PDF) แบบ private |
| `cron` | เรียกงานตามเวลาทุก 60 วินาที: ส่งอีเมล/LINE เตือนก่อนวันงาน จับคู่ประกาศงาน สรุปรายสัปดาห์ |
| `backup`, `backup-files` | สำรองฐานข้อมูลและไฟล์ทุก 24 ชั่วโมงลง `./backups` |
| `mailpit` | กล่องอีเมลจำลอง **สำหรับเครื่องพัฒนาเท่านั้น** |

## 2. ความต้องการของเครื่อง

- Linux หรือ Windows ที่ติดตั้ง Docker (Docker Engine + Compose v2)
- ขั้นต่ำ 2 vCPU, RAM 4 GB, ดิสก์ 20 GB (ไม่รวมไฟล์รูปที่สะสม)
- ผลทดสอบโหลด (2026-11-01, ศิษย์เก่า 20,000 คน): เว็บ 1 ชุดรับผู้ใช้ที่เปิดหน้าใหม่ทุก ~10 วินาทีได้ 300 คนพร้อมกันที่ p95 1.5 วินาที ฐานข้อมูลเป็นส่วนที่ใช้ CPU มากที่สุด — ถ้าคาดว่าช่วงงานคืนเหย้าจะมีผู้ใช้มากกว่านี้ให้เพิ่ม vCPU ของฐานข้อมูลก่อน (ดู SRS ภาคผนวก ค)
- โดเมนและใบรับรอง HTTPS (เช่น `alumni.eng.ksu.ac.th`)
- บัญชี SMTP ของมหาวิทยาลัยสำหรับส่งอีเมล

## 3. ติดตั้งครั้งแรก

```bash
git clone https://github.com/babankbro/KSU_EN_Alumni.git
cd KSU_EN_Alumni/webapp
cp .env.example .env
```

แก้ `.env` — **ค่าในไฟล์ตัวอย่างใช้ได้เฉพาะเครื่องพัฒนา**

| ตัวแปร | ตั้งเป็น |
|---|---|
| `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD` | รหัสสุ่มยาว (ตัวอักษรและตัวเลข เพราะใช้ใน URL) |
| `APP_SECRET`, `CRON_SECRET` | สตริงสุ่มยาวคนละค่า เช่น `openssl rand -hex 32` |
| `APP_URL` | URL จริงของเว็บ เช่น `https://alumni.eng.ksu.ac.th` (ใช้ในลิงก์อีเมล) |
| `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` | บัญชีผู้ดูแลคนแรก รหัสอย่างน้อย 12 ตัว — ใช้ครั้งเดียวตอนยังไม่มีบัญชีแอดมิน |
| `COOKIE_SECURE=true` | เมื่อให้บริการผ่าน HTTPS |
| `TRUST_PROXY=true` | **เฉพาะ**เมื่ออยู่หลัง reverse proxy ที่ตั้ง `X-Forwarded-For` ถูกต้อง |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | SMTP ของมหาวิทยาลัย |
| `WEB_PORT` | พอร์ตที่ reverse proxy จะส่งต่อมา เช่น 3000 |
| `POLICY_VERSION` | เลขฉบับนโยบายความเป็นส่วนตัว เปลี่ยนทุกครั้งที่แก้ `/privacy` |
| `LINE_*` | เว้นว่างได้ — ใส่เมื่อมี LINE Login / Messaging channel (callback: `${APP_URL}/api/auth/line/callback`) |
| `DEMO_SEED_MEDIA=false` | ปิดรูปตัวอย่าง |

ก่อนเริ่มระบบจริง ให้นำข้อมูลตัวอย่างออก: ลบไฟล์ `db/003_seed_sample.sql` (ศิษย์เก่าสมมติ ข่าว กิจกรรม ประกาศงานตัวอย่าง) — ไฟล์ใน `db/` รันอัตโนมัติเฉพาะตอนฐานข้อมูลว่าง

```bash
docker compose up -d --build
docker compose ps
```

ทุกบริการควรเป็น `Up` และ `web`, `db`, `minio` เป็น `(healthy)` จากนั้นเปิด `${APP_URL}/admin/login` ด้วยบัญชี bootstrap แล้ว**เปลี่ยนรหัสผ่านทันที**ที่หน้า “บัญชีเจ้าหน้าที่”

ถ้าไม่ใช้ Mailpit ในเครื่องจริง ให้ลบบริการ `mailpit` และ `depends_on` ของ `web` ที่อ้างถึงออกจาก `docker-compose.yml`

## 4. HTTPS ด้วย reverse proxy

ตัวอย่าง nginx (ปรับชื่อโดเมนและพาธใบรับรอง):

```nginx
server {
  listen 443 ssl;
  server_name alumni.eng.ksu.ac.th;
  ssl_certificate     /etc/ssl/alumni/fullchain.pem;
  ssl_certificate_key /etc/ssl/alumni/privkey.pem;
  client_max_body_size 32m;              # อัปโหลดรูปหลายไฟล์ในแกลเลอรี
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;   # เขียนทับ ไม่ต่อท้าย
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

แล้วตั้ง `COOKIE_SECURE=true` และ `TRUST_PROXY=true` และปิดพอร์ต 5432, 9000, 9001 จากภายนอกด้วย firewall (ใช้ภายในเครื่องเท่านั้น)

## 5. อัปเดตเวอร์ชัน

```bash
git pull
docker compose up -d --build
```

ถ้ามีไฟล์ใหม่ใน `db/` ให้รันกับฐานข้อมูลเดิมตามลำดับเลข (ทุกไฟล์ตั้งแต่ `004` รันซ้ำได้):

```bash
docker exec -i ksu-alumni-db psql -v ON_ERROR_STOP=1 -U alumni -d alumni < db/007_directory_speed.sql
```

สำรองก่อนอัปเดตทุกครั้ง: `docker compose restart backup` จะทำ dump ใหม่ทันที

## 6. สำรองและกู้คืน

- ไฟล์สำรองอยู่ที่ `webapp/backups/` (ฐานข้อมูล 14 ไฟล์ล่าสุด + สำเนาไฟล์) — **มีข้อมูลส่วนบุคคล** คัดลอกไปเก็บนอกเครื่องอย่างน้อยสัปดาห์ละครั้ง
- ทดสอบกู้คืนทุกเดือน: `sh scripts/restore-test.sh` (กู้ลงฐานชั่วคราวแล้วเทียบจำนวนแถว ไม่แตะฐานจริง)
- กู้คืนจริงและกู้ไฟล์: ดูหัวข้อ “การสำรองข้อมูล” ใน [../README.md](../README.md)

## 7. ตรวจสอบและแก้ปัญหา

| อาการ | ตรวจ |
|---|---|
| เว็บไม่ขึ้น `web` ค้างที่ `Created` | `docker compose ps` — `web` รอ `db` และ `minio` ให้ healthy ก่อน ดู `docker logs ksu-alumni-minio` |
| อีเมลไม่ถูกส่ง | `docker logs ksu-alumni-cron` และตาราง `notification` สถานะ `failed` / คอลัมน์ `last_error` |
| เข้าสู่ระบบแอดมินไม่ได้ | ผิด 5 ครั้งใน 15 นาทีจะถูกระงับชั่วคราว รอแล้วลองใหม่ · ถ้าลืมรหัส ให้แอดมินอีกคนตั้งให้ที่ “บัญชีเจ้าหน้าที่” |
| ทุกคนถูกล็อกพร้อมกัน | ตั้ง `TRUST_PROXY=true` ทั้งที่ไม่มี proxy ที่ตั้ง header ถูกต้อง — ตั้งกลับเป็น `false` |
| พอร์ตชน | เปลี่ยน `WEB_PORT`, `POSTGRES_PORT`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` ใน `.env` |
| log ของแอป | `docker logs ksu-en-alumni` |

ประวัติการกระทำสำคัญของเจ้าหน้าที่และผู้ใช้อยู่ในตาราง `audit_log` (แก้ไขย้อนหลังไม่ได้)
