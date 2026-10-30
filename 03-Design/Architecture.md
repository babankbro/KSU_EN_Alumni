---
title: Architecture
type: design
status: draft
created: 2026-09-23
tags: [design, architecture, stack]
---

# 🏗️ Architecture (ร่าง)

> ยังไม่ตัดสินใจ stack — ดู [[Open Questions]]

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

## สถานะปัจจุบัน: ระบบเต็ม (2026-10-30)

```
 Browser ──► web (Next.js, :3100) ──► PostgreSQL 16 (:5433)
                    │
                    └──────────────► MinIO (:9010, console :9011) — bucket ส่วนตัว
```

- **Docker Compose 3 service:** `db`, `minio`, `web` — ไฟล์ SQL ใน `webapp/db/` รันอัตโนมัติตอน volume ว่าง
- ไฟล์ทุกชิ้นส่งถึงเบราว์เซอร์ผ่าน `/api/files/:id` ซึ่งตรวจสิทธิ์ก่อน (ไม่ใช้ presigned URL)
- ฟอนต์ self-host จาก `@fontsource` — build ไม่ต้องต่ออินเทอร์เน็ตไป Google Fonts
- MinIO ตรึงด้วย digest เพราะ tag สาธารณะ pull ไม่ได้ในเครื่องนี้
- พอร์ตเว็บย้ายเป็น 3100 และ DB เป็น 5433 เพราะในเครื่องพัฒนามีโปรแกรมอื่นใช้ 3000/5432/9000/9001 อยู่
- รายละเอียด: [[Database Design]] · [[Admin Back Office]]

## Component ที่ต้องมี
- **Web app** (public + member area)
- **Admin panel**
- **Search service** — faceted search ภาษาไทย (พิจารณา Meilisearch/Typesense ถ้า DB ไม่พอ)
- **LINE integration** — Login + broadcast
- **Import pipeline** — ETL จาก CONGRATE/ทะเบียน + record linkage → [[Research Gap]]
- **Reporting/Analytics** — dashboard QA

## Integration ที่ต้องเช็ค
- [ ] CONGRATE มี API ไหม หรือได้แค่ CSV export
- [ ] TUC Digital ID — KSU เข้าร่วมหรือไม่ ([[Benchmark - University Level]])
- [ ] SSO ของมหาวิทยาลัย

[[Requirements]] · [[Data Model]]
