import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";

export const metadata: Metadata = {
  title: "เกี่ยวกับเรา",
  description:
    "เกี่ยวกับงานศิษย์เก่าสัมพันธ์ คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์",
};

export default function AboutPage() {
  return (
    <>
      <PageHead
        crumb="เกี่ยวกับเรา"
        title="เกี่ยวกับงานศิษย์เก่าสัมพันธ์"
        lead="เชื่อมโยงศิษย์เก่าทุกรุ่นเข้ากับคณะ และส่งต่อโอกาสให้รุ่นน้อง"
      />

      <section className="section">
        <div className="wrap">
          <div className="grid grid-2">
            <div>
              <h2>เราทำอะไร</h2>
              <p>
                งานศิษย์เก่าสัมพันธ์ดูแลฐานข้อมูลศิษย์เก่าของคณะ จัดกิจกรรมคืนสู่เหย้า
                และกิจกรรมแนะแนวอาชีพ รวมถึงรวบรวมข้อมูลภาวะการมีงานทำของบัณฑิต
                เพื่อนำกลับมาปรับปรุงหลักสูตร
              </p>
              <p>
                ข้อมูลที่ศิษย์เก่าอัปเดตไว้ถูกใช้เพื่อการติดต่อ การจัดกิจกรรม
                และการรายงานประกันคุณภาพการศึกษาเท่านั้น
              </p>
            </div>
            <div>
              <h2>ผู้ดูแลระบบและการแก้ไขข้อมูล</h2>
              <p>
                หากพบว่าข้อมูลของท่านไม่ถูกต้อง ต้องการถอนความยินยอม
                หรือขอให้ลบข้อมูลออกจากระบบ ติดต่อได้ที่งานศิษย์เก่าสัมพันธ์
                คณะวิศวกรรมศาสตร์
              </p>
              <ul>
                <li>อีเมล: alumni.eng@ksu.ac.th</li>
                <li>โทรศัพท์: 043-602-053</li>
                <li>LINE Official Account: @ksu-eng-alumni</li>
              </ul>
              <p style={{ marginTop: "16px" }}>
                <Link href="/contact" className="btn btn-outline">
                  ไปหน้าติดต่อ
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
