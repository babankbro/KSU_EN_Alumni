---
title: Data Model
type: design
status: draft
created: 2026-09-23
tags: [design, database, er]
---

# 🗄️ Data Model (ร่าง)

> ร่างเบื้องต้น — ปรับหลังเคลียร์ [[Open Questions]] เรื่องแหล่งข้อมูลตั้งต้น

## Entity หลัก

### `alumni` (ศิษย์เก่า)
- `id`, `student_code` (รหัสนักศึกษา, unique)
- `title_th`, `first_name_th`, `last_name_th`
- `first_name_en`, `last_name_en`
- `former_names[]` ← รองรับการเปลี่ยนชื่อ/นามสกุล (สำคัญสำหรับ record linkage)
- `birth_date`, `gender`
- `graduation_year`, `degree_level`, `program_id`
- `claim_status` (unclaimed / pending / verified)
- `profile_updated_at` ← ใช้แสดง "อัปเดตเมื่อ"
- `completeness_score`

### `contact` (ข้อมูลติดต่อ — แยกเพื่อคุม privacy)
- `alumni_id`, `email`, `phone`, `line_id`
- `address`, `province`, `country`
- `visibility` ต่อฟิลด์ (public / members / private)

### `employment` (ประวัติการทำงาน — รองรับ longitudinal)
- `alumni_id`, `organization`, `position`, `job_category`
- `salary_range`, `sector` (รัฐ/เอกชน/ประกอบกิจการเอง)
- `start_date`, `end_date`, `is_current`
- `is_related_to_major` (ตรงสาขาหรือไม่ — ใช้รายงาน QA)

### `skill` / `alumni_skill`
- ทักษะวิชาชีพ (ใช้ทั้ง faceted search และ job matching)

### `program` (หลักสูตร/สาขา)
- `id`, `name_th`, `name_en`, `degree_level`, `faculty`

### `job_post`
- `posted_by` (alumni_id), `title`, `organization`, `type` (งาน/ฝึกงาน)
- `description`, `required_skills[]`, `deadline`, `status`

### `news` / `event` / `event_registration`
### `award_nomination` (เสนอชื่อศิษย์เก่าดีเด่น)
### `survey` / `survey_response` (ภาวะการมีงานทำ)
### `consent_log` (PDPA — บันทึกการยินยอม) → [[PDPA and Privacy]]
### `audit_log` (ใครดูข้อมูลใคร เมื่อไหร่)

## ประเด็นออกแบบที่ต้องคิด
- **Soft delete + สิทธิลบข้อมูล (PDPA)** ขัดกัน → ต้องออกแบบ anonymization
- `employment` เป็น time-series → รองรับ career-path analytics ใน [[Research Gap]]
- Full-text search ภาษาไทย: ใช้อะไร (MySQL ngram / PostgreSQL + pg_trgm / Meilisearch)?

## TODO
- [ ] วาด ER diagram (Obsidian Canvas หรือ Mermaid)
- [ ] กำหนด field ที่มาจาก CONGRATE vs ที่ศิษย์เก่ากรอกเอง

[[Requirements]] · [[Architecture]]
