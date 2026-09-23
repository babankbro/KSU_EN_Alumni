# KSU Engineering Alumni — Web Application (draft)

เว็บแอปพลิเคชันร่างของระบบสารสนเทศศิษย์เก่า คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์

> ⚠️ ข้อมูลทั้งหมดในแอปนี้เป็น **ตัวอย่างสมมติ** ยังไม่ได้เชื่อมต่อฐานข้อมูลจริง

## Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- CSS ธรรมดาพร้อม design token (ไม่พึ่ง UI framework — ลดภาระการดูแลระยะยาว ตาม CON-01 ใน SRS)
- `output: "standalone"` เพื่อให้ Docker image เล็กและรันด้วย `node server.js` ได้ตรง ๆ

## รันบนเครื่อง
```bash
npm install
npm run dev     # http://localhost:3000
```

## Build
```bash
npm run build
npm start
```

## Docker
```bash
docker build -t ksu-en-alumni .
docker run --rm -p 3000:3000 ksu-en-alumni
```

หรือใช้ compose:
```bash
docker compose up --build
```

> **หมายเหตุ:** ขั้นตอน build ดึงฟอนต์ Sarabun ผ่าน `next/font/google`
> เครื่องที่ build จึงต้องต่ออินเทอร์เน็ตออกไป fonts.googleapis.com ได้
> ถ้า build ในเครือข่ายปิด ให้เปลี่ยนไปใช้ฟอนต์แบบ self-host แทน

## โครงสร้าง
```
src/
  app/
    layout.tsx           header/footer ร่วม
    page.tsx             หน้าแรก
    directory/           ทำเนียบศิษย์เก่า (FR-DIR)
    alumni-news/         ข่าวของศิษย์เก่า (FR-ANEWS)
    news/                ข่าวประชาสัมพันธ์ (FR-NEWS)
    events/              กิจกรรม (FR-EVT)
    privileges/          สิทธิประโยชน์
    contact/             ติดต่อ
  components/            คอมโพเนนต์ UI
  lib/
    types.ts             โครงสร้างข้อมูล (ตรงกับ 03-Design/Data Model.md)
    data.ts              ข้อมูลตัวอย่าง
    format.ts            จัดรูปแบบวันที่ พ.ศ. และการคำนวณความสดของข้อมูล
```

## การเชื่อมโยงกับเอกสารออกแบบ
โค้ดอ้างอิงรหัสความต้องการจาก `../03-Design/SRS.md` ไว้ในคอมเมนต์
เช่น `FR-DIR-06` (ซ่อนข้อมูลติดต่อจากผู้ที่ยังไม่เข้าสู่ระบบ) และ
`FR-PROF-04` (แสดงวันที่อัปเดตข้อมูลล่าสุด) เพื่อให้ตามรอยกลับไปยัง SRS ได้
