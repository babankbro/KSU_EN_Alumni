---
title: Visual Design
type: design
status: draft
created: 2026-09-23
reference: https://alumni.mahidol.ac.th/en/
tags: [design, ui, ux, visual, homepage]
---

# 🎨 Visual Design — KSU Engineering Alumni

แนวทางออกแบบ UI สำหรับระบบศิษย์เก่า คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์ โดยอ้างอิง **โครงหน้า ลำดับเนื้อหา และภาษาภาพ** จากเว็บไซต์ [Mahidol University Alumni Relations](https://alumni.mahidol.ac.th/en/) (สำรวจเมื่อ 2026-09-23) แล้วปรับเอกลักษณ์หลักเป็น **สีเลือดหมู** และปรับเนื้อหาให้ตรงกับบริบทของ KSU

> [!important] ขอบเขตการอ้างอิง
> ใช้เว็บไซต์ Mahidol Alumni เป็น reference ด้าน layout และ interaction เท่านั้น ห้ามคัดลอกโลโก้ ภาพถ่าย ข้อความ ไอคอนเฉพาะแบรนด์ หรือ asset ที่มีลิขสิทธิ์มาใช้โดยตรง

## 1. Design direction

**บุคลิก:** น่าเชื่อถือ · อบอุ่น · เชื่อมโยงรุ่นพี่รุ่นน้อง · ทันสมัยแต่ไม่เป็น corporate จนเกินไป

**แนวคิด:** “Engineering connections that last” — เว็บไซต์ต้องให้ความรู้สึกว่าเป็นทั้งประตูเข้าสู่เครือข่ายศิษย์เก่าและพื้นที่กลับมาเชื่อมต่อกับคณะ

องค์ประกอบที่นำมาปรับใช้จาก reference:

- Header สองระดับ: ข้อมูลติดต่อ/ปุ่มสำคัญด้านบน และ navigation ด้านล่าง
- Hero ภาพเต็มพื้นที่ มีสีเข้ม overlay และข้อความขนาดใหญ่กลางภาพ
- Section heading ขนาดใหญ่ พร้อมปุ่ม “ดูทั้งหมด” ทางขวา
- การ์ดศิษย์เก่าดีเด่นเป็นภาพบุคคลเต็มใบ พร้อม gradient และชื่อด้านล่าง
- การ์ดกิจกรรมและข่าวเรียง 3 คอลัมน์บน desktop
- สลับพื้นหลังขาวกับพื้นสีอ่อนเพื่อแบ่งจังหวะเนื้อหา
- CTA ขนาดใหญ่, แถบตัวเลขสถิติ และ footer ที่ให้ข้อมูลครบ

## 2. Color system — เลือดหมู

แทนที่โทนน้ำเงินของเว็บ reference ด้วยสีเลือดหมู โดยใช้สีทองเพียงเล็กน้อยเป็น accent เพื่อให้ดูเป็นสถาบันและมีระดับ

| Token | สี | การใช้งาน |
|---|---|---|
| `--color-primary-900` | `#4A0010` | footer, hero overlay, section เข้ม |
| `--color-primary-800` | `#5C0014` | navigation active, ปุ่มสถานะกด |
| `--color-primary-700` | `#730018` | สีแบรนด์หลัก |
| `--color-primary-600` | `#8B1028` | ปุ่มหลัก, link, icon |
| `--color-primary-500` | `#A62A42` | hover, highlight, badge |
| `--color-primary-100` | `#F5E8EB` | พื้นหลัง section สีอ่อน |
| `--color-accent` | `#C7A24A` | เส้นเน้น, badge พิเศษ, ศิษย์เก่าดีเด่น |
| `--color-ink` | `#231F20` | ข้อความหลัก |
| `--color-muted` | `#6B6670` | metadata และข้อความรอง |
| `--color-surface` | `#FFFFFF` | card และพื้นหลัก |
| `--color-canvas` | `#FAF7F7` | พื้นหลังหน้า |
| `--color-border` | `#E6DADD` | เส้นแบ่งและกรอบ input |
| `--color-success` | `#247A52` | สถานะยืนยันแล้ว/ข้อมูลปัจจุบัน |
| `--color-error` | `#B42318` | error และ destructive action |

### สัดส่วนการใช้สี

- 70% ขาว/สีพื้นอ่อน
- 20% เลือดหมู
- 8% สีข้อความและเทากลาง
- 2% ทองสำหรับจุดเน้นเท่านั้น

หลีกเลี่ยงการใช้พื้นเลือดหมูเต็มหน้าหลาย section ต่อกัน เพราะจะทำให้หน้าเว็บหนักและลดความเด่นของ CTA

## 3. Typography

| บทบาท | ฟอนต์แนะนำ | น้ำหนัก |
|---|---|---|
| ภาษาไทย | `Noto Sans Thai` หรือ `IBM Plex Sans Thai` | 400 / 500 / 600 / 700 |
| ภาษาอังกฤษและตัวเลข | `Inter` | 400 / 500 / 600 / 700 |

### Type scale

| Style | Desktop | Mobile | การใช้งาน |
|---|---:|---:|---|
| Display | 56–64 px | 36–42 px | ข้อความหลักใน hero |
| H1 | 48 px | 34 px | ชื่อหน้าภายใน |
| H2 | 40 px | 30 px | หัวข้อ section หน้าแรก |
| H3 | 24 px | 21 px | ชื่อ card / subsection |
| Body large | 18 px | 17 px | intro และข้อความสำคัญ |
| Body | 16 px | 16 px | เนื้อหาทั่วไป |
| Small | 14 px | 14 px | วันที่, metadata, label |

- ความยาวบรรทัดเนื้อหาไม่เกิน 65–75 ตัวอักษร
- Line height ภาษาไทยอย่างน้อย `1.6`
- หลีกเลี่ยงตัวพิมพ์ใหญ่ทั้งคำในภาษาอังกฤษที่ยาวเกินหนึ่งบรรทัด

## 4. Layout system

- Content container สูงสุด `1200px`
- Desktop grid 12 คอลัมน์, gutter `24px`
- Tablet grid 8 คอลัมน์, gutter `20px`
- Mobile grid 4 คอลัมน์, gutter `16px`
- ระยะห่าง section: `96px` desktop / `64px` tablet / `48px` mobile
- Card radius `8px`; ปุ่ม radius `4px` เพื่อคงบุคลิกแบบสถาบัน
- Shadow ใช้บาง: `0 8px 24px rgba(74, 0, 16, 0.08)`

## 5. Homepage structure

ลำดับนี้ถอดจาก flow ของเว็บ reference แต่ปรับให้ตอบโจทย์ [[Requirements]] และ [[Engagement Strategy]]

### 5.1 Utility bar

แถบบนพื้น `#F5E8EB` สูงประมาณ `40px`

- ซ้าย: เบอร์โทร · อีเมล · Facebook · LINE OA
- ขวา: `TH | EN`
- ซ่อนข้อมูลติดต่อแบบยาวบน mobile เหลือเฉพาะ icon และ language switcher

### 5.2 Main header

พื้นขาว สูง `80–88px` และ sticky เมื่อ scroll

- โลโก้ KSU + ชื่อ “Engineering Alumni” ทางซ้าย
- เมนู: หน้าแรก · ทำเนียบศิษย์เก่า · ข่าวสาร · กิจกรรม · งานและฝึกงาน · เกี่ยวกับเรา
- ปุ่ม outline: **ลงทะเบียน/Claim โปรไฟล์**
- ปุ่ม primary สีเลือดหมู: **เข้าสู่ระบบ**
- active menu ใช้เส้นใต้สีเลือดหมูหนา `3px`

### 5.3 Hero

ความสูง `620–720px` desktop และอย่างน้อย `540px` mobile

- ใช้ภาพจริงของคณะหรือกิจกรรมศิษย์เก่าแบบเต็มพื้นที่
- Overlay ไล่สีจาก `rgba(74,0,16,.92)` ไป `rgba(74,0,16,.52)`
- eyebrow: `KALASIN UNIVERSITY`
- headline: **“เชื่อมรุ่นพี่ สร้างโอกาส เติบโตไปด้วยกัน”**
- supporting text ไม่เกิน 2 บรรทัด
- CTA หลัก: **ค้นหาศิษย์เก่า**
- CTA รอง: **Claim โปรไฟล์ของฉัน**
- มี quick link 3 รายการด้านล่าง hero: ทำเนียบศิษย์เก่า · งานและฝึกงาน · สิทธิประโยชน์

> ถ้ายังไม่มีภาพคุณภาพสูง ใช้ภาพอาคารหรือกิจกรรมจริงเพียงภาพเดียว ไม่ใช้ stock photo ที่ดูไม่เกี่ยวข้องกับ KSU

### 5.4 Alumni statistics

แถบพื้นเลือดหมูเข้มหรือวางซ้อนปลาย hero เล็กน้อย แสดงตัวเลข 4 ช่อง:

- จำนวนศิษย์เก่า
- จำนวนรุ่น
- จำนวนสาขา
- โปรไฟล์ที่อัปเดตใน 12 เดือน

ตัวเลขต้องดึงจากฐานข้อมูลจริง และใช้ skeleton/`—` ระหว่างโหลด ห้ามแสดงเลขตัวอย่างเหมือนเป็นข้อมูลจริง

### 5.5 Alumni recognition

หัวข้อ **ศิษย์เก่าที่สร้างแรงบันดาลใจ** + ปุ่ม “ดูทั้งหมด”

- Desktop 4 cards / Tablet 2 / Mobile 1.2 เพื่อบอกว่าสามารถ swipe ได้
- Card ratio `3:4`, ใช้ภาพเต็ม card
- gradient ด้านล่างจากโปร่งใสไป `#4A0010`
- แสดงชื่อ, รุ่น/สาขา และผลงานสั้นหนึ่งบรรทัด
- hover: ภาพขยาย `1.03`, overlay เข้มขึ้น และแสดง “อ่านเรื่องราว”

### 5.6 Upcoming events

พื้น `#F5E8EB` และใช้การ์ด 3 คอลัมน์ตาม reference

- ภาพปก ratio `16:10`
- วันที่และเวลาใช้สีเลือดหมู
- ชื่องานไม่เกิน 2 บรรทัด
- icon สถานที่ + รูปแบบ Online/Onsite
- ถ้าเต็มให้แสดง badge “เต็มแล้ว”; ถ้าปิดรับให้ลด opacity ของ CTA
- Mobile เปลี่ยนเป็น horizontal scroll ไม่ใช้ carousel autoplay

### 5.7 Latest news

พื้นขาว หัวข้อ **ข่าวสารล่าสุด**

- ข่าวเด่น 1 ชิ้นกินพื้นที่ 6 คอลัมน์
- ข่าวรอง 2–4 ชิ้นอยู่ด้านขวาหรือเรียง 3 cards เมื่อเนื้อหามีขนาดเท่ากัน
- แสดงหมวดหมู่, วันที่, headline, excerpt และ “อ่านต่อ”
- ใช้ภาพจริงและกำหนด focal point เพื่อ crop ได้ดีทุก breakpoint

### 5.8 Alumni directory CTA

ส่วนนี้เพิ่มจาก reference เพื่อเน้น differentiator ใน [[Feature Matrix]]

- Split layout: ข้อความ 5 คอลัมน์ + mock search panel 7 คอลัมน์
- headline: **“เครือข่ายของคุณอยู่ใกล้กว่าที่คิด”**
- แสดงตัวอย่าง filter: รุ่น · สาขา · จังหวัด · บริษัท · ทักษะ
- CTA: **เปิดทำเนียบศิษย์เก่า**
- ระบุสั้น ๆ ว่าข้อมูลติดต่อดูได้เฉพาะสมาชิกตาม [[PDPA and Privacy]]

### 5.9 Jobs and internships

พื้น `#F5E8EB`

- รายการงาน 3 cards: ตำแหน่ง · บริษัท · ประเภทงาน · สถานที่ · วันปิดรับ
- badge “โพสต์โดยศิษย์เก่า” เป็นสีทองอ่อน
- CTA: **ดูตำแหน่งทั้งหมด** และ **ประกาศงาน**

### 5.10 Alumni stories / video

อ้างอิง section Alumni Talk ของเว็บต้นแบบ

- วิดีโอเด่น 1 ชิ้น + เรื่องราวรอง 2 ชิ้น
- ใช้ thumbnail พร้อมปุ่ม play ที่มี label สำหรับ screen reader
- ไม่ autoplay และไม่โหลด player ภายนอกจนกว่าผู้ใช้จะกด

### 5.11 Engagement CTA

พื้นเลือดหมูเข้ม มี pattern เส้นแบบ engineering บาง ๆ

- headline: **“กลับมาอัปเดตเรื่องราวของคุณ”**
- ข้อความอธิบายประโยชน์ของข้อมูลที่เป็นปัจจุบัน
- ปุ่มพื้นขาว: **อัปเดตโปรไฟล์**
- link รอง: **ข้อมูลของฉันถูกใช้เพื่ออะไร?**

### 5.12 Contact and footer

- แผนที่/ภาพอาคาร 6 คอลัมน์ + ข้อมูลติดต่อ 6 คอลัมน์
- Footer พื้น `#4A0010`, ตัวอักษรขาว
- กลุ่มลิงก์: ระบบศิษย์เก่า · บริการ KSU · ช่วยเหลือ · กฎหมาย/ความเป็นส่วนตัว
- แสดงผู้รับผิดชอบระบบและช่องทางแจ้งแก้ไขข้อมูล

## 6. Components

### Buttons

- Primary: พื้น `#730018`, text ขาว; hover `#5C0014`
- Secondary: พื้นขาว, border `#730018`, text `#730018`
- Text button: ไม่มีกรอบ มีลูกศรขวา และ underline เมื่อ hover
- ความสูงขั้นต่ำ `44px`; touch target อย่างน้อย `44 × 44px`

### Cards

- Event/news card ใช้พื้นขาวและ border บางแทน shadow หนัก
- รูปภาพต้องมี `aspect-ratio` คงที่เพื่อป้องกัน layout shift
- Card ทั้งใบกดได้ แต่ link ต้องมีชื่อที่ screen reader เข้าใจได้

### Forms and search

- Input สูง `48px`, border `#CDBEC2`, focus ring `0 0 0 3px rgba(139,16,40,.22)`
- Label อยู่เหนือช่องเสมอ ไม่ใช้ placeholder แทน label
- Facet บน mobile เปิดใน bottom sheet; desktop อยู่ sidebar ซ้าย
- แสดงจำนวนผลลัพธ์และ filter chips ที่ลบทีละรายการได้

### Badges

- `ข้อมูลเป็นปัจจุบัน`: เขียว
- `ควรอัปเดต`: เหลืองเข้มบนพื้นเหลืองอ่อน
- `ยังไม่ Claim`: เทากลาง และไม่แสดงข้อมูลส่วนบุคคล

## 7. Responsive behavior

| Breakpoint | พฤติกรรมหลัก |
|---|---|
| `≥ 1200px` | container เต็ม, card 3–4 คอลัมน์, navigation ครบ |
| `768–1199px` | ลดเป็น 2 คอลัมน์, ซ่อน utility text บางส่วน |
| `< 768px` | hamburger menu, card 1 คอลัมน์/horizontal scroll, CTA เต็มความกว้าง |

- Header บน mobile เหลือ logo + language + menu
- Hero จัดข้อความชิดซ้าย ไม่วางข้อความทับส่วนสำคัญของภาพ
- ตารางกว้างเปลี่ยนเป็น stacked cards
- ห้ามใช้ interaction ที่ต้อง hover เท่านั้น

## 8. Accessibility and privacy by design

- สีข้อความปกติต้องผ่าน WCAG AA contrast อย่างน้อย `4.5:1`
- มี skip link, visible focus, landmark และลำดับ heading ที่ถูกต้อง
- รูปบุคคลใช้ alt text ที่บอกชื่อและบริบท โดยไม่ตีความรูปลักษณ์เกินจำเป็น
- รองรับ keyboard ครบ รวม carousel/slider
- เคารพ `prefers-reduced-motion`; transition ไม่เกิน `200–300ms`
- ห้ามแสดงเบอร์โทร อีเมล ที่อยู่ หรือสถานที่ทำงานของศิษย์เก่าที่ยังไม่ claim/ไม่ให้ consent
- ปุ่ม social share ต้องไม่โหลด tracker จนกว่าผู้ใช้จะกด

## 9. Content mapping

| Section | แหล่งข้อมูล |
|---|---|
| สถิติ | `alumni`, `program`, `profile_updated_at` ใน [[Data Model]] |
| ศิษย์เก่าดีเด่น | `award_nomination` ที่อนุมัติแล้ว |
| กิจกรรม | `event` + `event_registration` |
| ข่าวสาร | `news` |
| งานและฝึกงาน | `job_post` สถานะ active |
| Search CTA | alumni directory ตาม FR-05 |
| Profile freshness | `profile_updated_at` + `completeness_score` |

## 10. Page priority

1. **Homepage** — สร้างความน่าเชื่อถือและพาไปยัง action สำคัญ
2. **Alumni Directory** — faceted search ซึ่งเป็นจุดต่างหลัก
3. **Alumni Profile** — freshness, privacy รายฟิลด์ และ career timeline
4. **Claim Profile** — flow สั้นที่สุดและอธิบาย consent ชัดเจน
5. **Events / News / Jobs** — ใช้ component system เดียวกัน
6. **Admin dashboard** — เน้นข้อมูลและประสิทธิภาพ ไม่จำเป็นต้องเลียน visual ของ public site

## 11. Do / Don’t

### Do

- ใช้ภาพจริงของ KSU และศิษย์เก่าที่ได้รับอนุญาต
- รักษาพื้นที่ว่างและ section rhythm แบบเว็บ reference
- ใช้เลือดหมูเป็นสีหลักอย่างมีลำดับชั้น
- วาง CTA ที่นำไปสู่ directory และ claim profile ให้เด่นที่สุด

### Don’t

- คัดลอก logo, photo, copywriting หรือ asset จาก Mahidol
- ทำ carousel autoplay เร็วหรือมีหลาย slider ต่อกัน
- ใช้สีทองกับข้อความยาวบนพื้นขาว เพราะ contrast ต่ำ
- เปิดเผยข้อมูล directory ต่อบุคคลทั่วไป
- ใส่ทุก feature ในหน้าแรกจน hierarchy หาย

## 12. Definition of done สำหรับ UI

- [ ] มี wireframe desktop และ mobile ของ Homepage
- [ ] มี component states: default / hover / focus / disabled / error / loading
- [ ] ทดสอบ contrast และ keyboard navigation
- [ ] เนื้อหาไทยไม่ล้นที่ viewport `320px`
- [ ] ภาพทุกภาพมี permission และ alt text
- [ ] หน้า directory ไม่แสดงข้อมูล private ก่อน login
- [ ] Lighthouse: Accessibility ≥ 90 และไม่มี CLS จากภาพ/card
- [ ] ผ่านการรีวิวกับผู้ดูแลคณะและตัวแทนศิษย์เก่า

## ลิงก์

[[Home]] · [[Requirements]] · [[Architecture]] · [[Data Model]] · [[PDPA and Privacy]] · [[Engagement Strategy]]
