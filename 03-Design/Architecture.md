---
title: Architecture
type: design
status: active
created: 2026-09-23
updated: 2026-11-04
tags: [design, architecture, stack]
---

# 🏗️ Architecture (ร่าง)

> ระบบสร้างด้วย Next.js + PostgreSQL + MinIO แล้ว แต่ยังต้องให้ทีม IT ยืนยันว่าดูแลต่อได้ (CON-01) — ดู [[Open Questions]]

## ข้อจำกัด/เงื่อนไขที่รู้แล้ว
- ต้อง host บนโครงสร้างที่มหาวิทยาลัยดูแลต่อได้ → **NFR-05** ใน [[Requirements]]
- บทเรียนจากระบบเดิมที่ล่ม ([[Benchmark - KSU]]) — เลือกเทคโนโลยีที่ทีม IT ดูแลได้จริง ไม่ใช่ที่เราถนัดอย่างเดียว
- Mobile-first
- ต้องเชื่อม **LINE Messaging API + LINE Login** ([[Design Insights]] ข้อ 4)

## ตัวเลือก Stack

| ตัวเลือก | ข้อดี | ข้อเสีย |
|---|---|---|
| **Laravel + MySQL** | ทีม IT มหาวิทยาลัยไทยคุ้นเคยที่สุด, ecosystem แน่น | เป็น monolith |
| **Next.js + PostgreSQL** | DX ดี, SSR/SEO ดี, เหมาะทำ dashboard | ทีมดูแลต่ออาจไม่คุ้น |
| **Django + PostgreSQL** | admin สำเร็จรูป, เหมาะงานวิจัย/วิเคราะห์ข้อมูล | ต้องมีคนรู้ Python |

> งานวิจัยไทยส่วนใหญ่ใช้ PHP/MySQL + Bootstrap ([[Thai Alumni System Research]]) — เลือกตามความยั่งยืน ไม่ใช่ตามความใหม่

## สถานะปัจจุบัน: prototype ใช้ Next.js

`webapp/` เป็น prototype ที่ implement ด้วย **Next.js 15 (App Router) + React 19 + TypeScript**
build เป็น Docker image ได้แล้ว (`output: "standalone"`, image ~229 MB, รันเป็น non-root)

**เหตุผลที่เลือกในขั้น prototype**
- ได้ผลลัพธ์ที่ใช้สาธิตกับผู้มีส่วนได้ส่วนเสียเร็ว หน้าทั้งหมด prerender เป็น static ได้
- TypeScript ทำให้ [[Data Model]] กลายเป็น type จริงที่ตรวจสอบได้ตอน compile
- `standalone` output ทำให้ deploy ด้วย `node server.js` ได้ตรง ๆ ไม่ต้องมี toolchain บนเครื่อง production

> ⚠️ **ข้อขัดแย้งที่ยังไม่ได้ข้อสรุป:** CON-01 ระบุว่าต้องเลือกเทคโนโลยีที่ทีมไอทีของมหาวิทยาลัยดูแลต่อได้
> ซึ่งในบริบทมหาวิทยาลัยไทยมักหมายถึง PHP/Laravel มากกว่า Node/Next.js
> การเลือก Next.js ในขั้นนี้เป็นการตัดสินใจระดับ **prototype** เท่านั้น
> **ต้องยืนยันกับทีมไอทีก่อนใช้เป็น stack จริง** — ถ้าทีมดูแล Node ไม่ได้ ควรย้ายไป Laravel
> โดยใช้ prototype นี้เป็นสเปก UI แทน → [[Open Questions]]

## สถานะปัจจุบัน: ระบบเต็ม (อัปเดต 2026-11-04)

```
 Browser ──► nginx (HTTPS, HSTS) ──► web (Next.js) ──► PostgreSQL 16 ◄── backup (pg_dump ทุก 24 ชม.)
                                      ▲     │
              cron (ทุก 60 วินาที) ───┘     └──► MinIO (bucket ส่วนตัว) ◄── backup-files
```

- **Docker Compose 7 service:** `web`, `db`, `minio`, `cron`, `backup`, `backup-files`, `mailpit` (Mailpit ใช้แทน SMTP จนกว่าจะได้บัญชีของมหาวิทยาลัย) — ไฟล์ SQL ใน `webapp/db/` รันอัตโนมัติตอน volume ว่าง
- **Production:** https://alumni.iaaaiksu.com บนเซิร์ฟเวอร์ที่ใช้ร่วมกับโปรเจ็คอื่น — เปิดเฉพาะ `web` ที่ `127.0.0.1:3200` ให้ nginx ของเครื่อง proxy เข้า ส่วน db/minio อยู่ใน compose network เท่านั้น (`docker-compose.prod.yml`)
- ไฟล์ทุกชิ้นส่งถึงเบราว์เซอร์ผ่าน `/api/files/:id` ซึ่งตรวจสิทธิ์ก่อน (ไม่ใช้ presigned URL)
- ฟอนต์ self-host จาก `@fontsource` — build ไม่ต้องต่ออินเทอร์เน็ตไป Google Fonts
- MinIO ตรึงด้วย digest เพราะ tag สาธารณะ pull ไม่ได้ในเครื่องนี้
- พอร์ตเว็บย้ายเป็น 3100 และ DB เป็น 5433 เพราะในเครื่องพัฒนามีโปรแกรมอื่นใช้ 3000/5432/9000/9001 อยู่
- รายละเอียด: [[Database Design]] · [[Admin Back Office]]

### สมรรถนะ (ผลวัดใน [[SRS]] ภาคผนวก ค)
- ค้นหาทำเนียบใช้ PostgreSQL `pg_trgm` — ช้าสุด 0.59 วินาทีที่ 20,000 ระเบียน จึง**ไม่ต้องมี search service แยก**
- ความยินยอมล่าสุดและงานปัจจุบันเก็บในระเบียนศิษย์เก่าผ่าน trigger (`007`) แทนการคำนวณทุกครั้ง
- ตัวเลขสรุปที่ไม่ระบุบุคคล (facet, สถิติหน้าแรก) cache ในหน่วยความจำ 1–5 นาที
- ปิด JIT ของ PostgreSQL (`008`) — หน้าแรกจาก 1.3 เหลือ 0.05 วินาที
- รูปย่อตามขนาดที่แสดงด้วย `sharp` (`/api/files/:id?w=`) เป็น WebP — หน้าแรกบนมือถือ 230 KB
- เว็บ 1 ชุดรับได้ ~35 คำขอ/วินาที (300 คนพร้อมกัน p95 1.52 s) ฐานข้อมูลเป็นคอขวด CPU

### ความปลอดภัย (OWASP — [[SRS]] ภาคผนวก ค)
- CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy ทุกหน้า · HSTS ที่ nginx
- API สาธารณะ (`/api/register`, `/api/upload`) ปฏิเสธ Origin ต่างโดเมน · จำกัดการอัปโหลด
- Next.js 15.5.29 — ช่องโหว่ระดับ moderate ที่เหลือต้องย้ายไป Next 16

## Component ที่ต้องมี
- **Web app** (public + member area)
- **Admin panel**
- ~~**Search service**~~ — ไม่จำเป็น PostgreSQL + pg_trgm ผ่าน NFR-PERF-02
- **LINE integration** — Login + broadcast
- **Import pipeline** — ETL จาก CONGRATE/ทะเบียน + record linkage → [[Research Gap]]
- **Reporting/Analytics** — dashboard QA

## Integration ที่ต้องเช็ค
- [ ] CONGRATE มี API ไหม หรือได้แค่ CSV export
- [ ] TUC Digital ID — KSU เข้าร่วมหรือไม่ ([[Benchmark - University Level]])
- [ ] SSO ของมหาวิทยาลัย

[[Requirements]] · [[Data Model]]
