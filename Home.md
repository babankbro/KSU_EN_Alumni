---
title: KSU ENG Alumni — Home
type: moc
status: active
created: 2026-09-23
tags: [moc, alumni, ksu]
---

# 🏠 KSU Engineering Alumni — Home

Vault สำหรับโปรเจ็ค **ระบบศิษย์เก่า คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์**
(สาขาวิศวกรรมคอมพิวเตอร์ — งานพัฒนาระบบ + งานวิจัยตีพิมพ์)

## 🎯 เริ่มที่นี่
- [[Project Charter]] — เป้าหมาย ขอบเขต ผู้มีส่วนได้ส่วนเสีย
- [[Open Questions]] — คำถามที่ยังต้องตัดสินใจ
- [[Roadmap]] — แผนการทำงานเป็นเฟส

## 📚 Research
- [[Research MOC]] — สารบัญงาน research ทั้งหมด
- [[Feature Matrix]] — ตารางเทียบฟีเจอร์ของทุกเว็บที่สำรวจ
- [[Sources]] — แหล่งอ้างอิงทั้งหมด

## 🏗️ Design
- [[SRS]] — **Software Requirements Specification ฉบับเต็ม** ⭐ (v0.2 — 2026-10-30)
- [[Admin Back Office]] — ระบบจัดการ: ข่าว, ข้อความ/รูปบนเว็บ, ข้อมูลและจำนวนสมาชิก
- [[Database Design]] — schema PostgreSQL ที่ใช้งานจริง + MinIO
- [[Requirements]] — ความต้องการฉบับย่อ (สรุปจาก SRS)
- [[Visual Design]] — แนวทาง UI จาก Mahidol Alumni ปรับเป็นโทนเลือดหมู
- [[Data Model]] — ร่างแนวคิดโครงสร้างข้อมูล (ฉบับใช้งานจริงคือ [[Database Design]])
- [[Architecture]] — สถาปัตยกรรมและ tech stack
- [[PDPA and Privacy]] — ข้อกำหนดด้านความเป็นส่วนตัว

## 🎨 Prototype
- `webapp/` — **แอป Next.js 15 + TypeScript + PostgreSQL + MinIO** (ตัวหลัก) โทนเลือดหมู
  - วิธีรันอยู่ใน `webapp/README.md` (ต้องตั้ง `ADMIN_BOOTSTRAP_PASSWORD` ใน `.env` ก่อน)
  - เครื่องนี้: เว็บ http://localhost:3100 · สมัคร `/register` · **หลังบ้าน `/admin`** · MinIO console :9011 · PostgreSQL :5433
  - บัญชีผู้ดูแลคนแรกอยู่ใน `webapp/.env` (ไฟล์นี้ไม่ขึ้น git)
  - โค้ดอ้างอิงรหัส FR จาก [[SRS]] ไว้ในคอมเมนต์
- `website/` — เว็บ static ร่างแรก (เก็บไว้อ้างอิงผัง)
  รันด้วย: `python -m http.server 5180 --directory website`

## 📝 Paper
- [[Literature Review]] — บทที่ 2
- [[Research Gap]] — ช่องว่างงานวิจัยและ contribution

---

## โครงสร้าง Vault

| โฟลเดอร์ | ใช้ทำอะไร |
|---|---|
| `00-Inbox` | โน้ตใหม่ที่ยังไม่จัดหมวด |
| `01-Project` | เอกสารบริหารโปรเจ็ค |
| `02-Research` | ผลสำรวจ benchmark + งานวิจัย |
| `03-Design` | requirement, data model, architecture |
| `04-Meetings` | บันทึกประชุม / daily log |
| `05-Paper` | ร่างบทความวิชาการ |
| `06-Assets` | รูปภาพและไฟล์แนบ |
| `99-Templates` | เทมเพลตโน้ต |
