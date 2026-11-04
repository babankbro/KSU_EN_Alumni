---
title: Roadmap
type: project
status: draft
created: 2026-09-23
updated: 2026-11-04
tags: [project, planning]
---

# 🗺️ Roadmap

> สถานะ 2026-11-04: Phase 1–3 พัฒนาครบตาม [[SRS]] v0.4 แล้ว ขั้นต่อไปคือ **ก่อนเปิดใช้จริง** และ Phase 4

## Phase 0 — Discovery
- [x] Research เว็บศิษย์เก่าในไทย → [[Research MOC]]
- [ ] เคลียร์ [[Open Questions]] ข้อสำคัญ
- [ ] สัมภาษณ์ผู้มีส่วนได้ส่วนเสีย → เก็บใน `04-Meetings`
- [x] สรุปความต้องการ → [[SRS]] v0.4 (ยังเป็นร่าง รอยืนยันกับผู้มีส่วนได้ส่วนเสีย)

## Phase 1 — Foundation
- [x] [[Data Model]] → [[Database Design]] (migration `001`–`009`)
- [x] [[Architecture]] — ใช้ Next.js + PostgreSQL + MinIO (รอทีม IT ยืนยัน CON-01)
- [x] Import ข้อมูลตั้งต้นจาก CSV + claim profile ด้วยรหัสนักศึกษา (API ทะเบียนรอ ASM-01)
- [x] Auth + โปรไฟล์ศิษย์เก่า

## Phase 2 — Core features
- [x] Alumni directory + faceted search (จุดต่างหลัก — ดู [[Benchmark - Faculty Level]]) — ช้าสุด 0.59 วินาทีที่ 20,000 ระเบียน
- [x] ข่าวสาร / ข่าวศิษย์เก่า / กิจกรรม / gallery
- [x] แจ้งเตือนทางอีเมลและในเว็บ
- [ ] แจ้งเตือนผ่าน LINE OA — โค้ดพร้อม รอ channel จริงของคณะ

## Phase 3 — Differentiators
- [x] Job board (ฝึกงาน + สมัครงาน)
- [x] แบบสำรวจภาวะการมีงานทำ + dashboard QA
- [x] ศิษย์เก่าดีเด่น + ระบบเสนอชื่อ

## ก่อนเปิดใช้จริง (เพิ่ม 2026-11-04)
- [x] ขึ้นเซิร์ฟเวอร์ https://alumni.iaaaiksu.com
- [x] สำรองข้อมูลอัตโนมัติ + ทดสอบกู้คืน (NFR-SEC-05)
- [x] ตรวจ OWASP Top 10 ด้วยตนเอง (NFR-SEC-02)
- [x] คู่มือติดตั้ง ผู้ดูแล ผู้ใช้ (NFR-MNT-01)
- [ ] ลบข้อมูลตัวอย่าง (`db/003_seed_sample.sql`, ข่าว/กิจกรรม/อัลบั้มทดสอบ)
- [ ] ยืนยันรายชื่อหลักสูตรกับงานทะเบียน → [[Open Questions]]
- [ ] ตั้ง SMTP ของมหาวิทยาลัย และ LINE channel
- [ ] DPO ตรวจหน้า `/privacy` → [[PDPA and Privacy]]
- [ ] ฝ่าย IT ทดสอบเจาะระบบ
- [ ] Lighthouse บนโทรศัพท์จริง (NFR-PERF-01)
- [ ] ทดสอบ claim โปรไฟล์กับศิษย์เก่าจริง ภายใน 3 นาที (NFR-USE-01)
- [ ] คณะยืนยันเป้าหมายผู้ใช้พร้อมกัน (NFR-PERF-03) และผู้รับผิดชอบระบบ (NFR-MNT-02)
- [ ] แยก role ฐานข้อมูลสำหรับ migration กับแอป

## Phase 4 — Research output
- [ ] เก็บข้อมูลประเมินระบบ (ประสิทธิภาพ + ความพึงพอใจ/TAM)
- [ ] เขียนบทความ → `05-Paper`

[[Home]] · [[Project Charter]]
