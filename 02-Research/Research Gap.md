---
title: Research Gap
type: research
created: 2026-09-23
tags: [research, gap, contribution]
---

# 🔬 Research Gap & Contribution ที่เป็นไปได้

## Gap ที่ระบุได้จาก research
1. งานวิจัยไทยเรื่องระบบศิษย์เก่าส่วนใหญ่หยุดที่ "พัฒนาระบบ + วัดความพึงพอใจ" ([[Thai Alumni System Research]])
2. ไม่มีงานไหนแก้ปัญหา **data decay / retention** ของฐานข้อมูลศิษย์เก่าอย่างเป็นระบบ
3. ระบบภาวะการมีงานทำเก็บข้อมูล **ครั้งเดียวตอนจบ** ไม่มี longitudinal tracking ([[Benchmark - Employment Survey]])
4. ไม่มีระบบไหนทำ mentorship matching หรือ career-path analytics ([[Feature Matrix]])

## Contribution ที่เป็นไปได้ (เรียงตามความยาก)

### 1. Record linkage / deduplication
รวมข้อมูลศิษย์เก่าจากหลายแหล่ง (ทะเบียน + CONGRATE + สมัครเอง + Facebook รุ่น) ที่มีชื่อสะกดต่างกัน
→ ใช้ fuzzy matching ที่ปรับสำหรับ **ภาษาไทย** (คำนำหน้า, การเปลี่ยนชื่อ-นามสกุล, การสมรส)
→ ประเมินด้วย precision/recall เทียบกับ ground truth

### 2. Job / internship matching
Recommender จับคู่ประกาศงานจากศิษย์เก่า ↔ ทักษะของนักศึกษาปัจจุบัน
→ content-based / embedding-based ประเมินด้วย top-k accuracy

### 3. Career-path analytics
วิเคราะห์เส้นทางอาชีพของบัณฑิตตามหลักสูตร → ป้อนกลับสู่การปรับปรุงหลักสูตร (closing the loop)
→ sequence mining / clustering เส้นทางอาชีพ

### 4. Engagement/retention experiment
ทดลอง A/B กลไกใน [[Engagement Strategy]] แล้ววัด **data freshness rate** และ return rate
→ เป็นงานเชิง empirical ที่หาคนทำน้อย

### 5. Mentorship matching
จับคู่รุ่นพี่-รุ่นน้องตามสายอาชีพ/ทักษะ/ภูมิลำเนา

## ที่ต้องตัดสินใจ
- เป้าหมายตีพิมพ์ (TCI 1/2 / conference / international) → [[Open Questions]]
- เลือก contribution 1 ข้อเป็นแกน อย่ากระจาย

[[Research MOC]] · [[Literature Review]]
