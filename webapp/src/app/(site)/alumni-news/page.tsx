import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import AlumniNewsFeed from "@/components/AlumniNewsFeed";
import { ALUMNI, ALUMNI_POSTS } from "@/lib/data";

export const metadata: Metadata = {
  title: "ข่าวของศิษย์เก่า",
  description:
    "ฟีดข่าวที่ศิษย์เก่าคณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์ ส่งเข้ามาเอง ผ่านการตรวจสอบก่อนเผยแพร่",
};

export default function AlumniNewsPage() {
  return (
    <>
      <PageHead
        crumb="ข่าวศิษย์เก่า"
        title="ข่าวของศิษย์เก่า"
        lead="ข่าวที่ศิษย์เก่าเป็นผู้ส่งเข้ามาเอง — ความก้าวหน้าในอาชีพ รางวัล ธุรกิจใหม่ และกิจกรรมของรุ่น"
      />

      <section className="section">
        <div className="wrap">
          <div className="grid feed-layout">
            <div>
              <AlumniNewsFeed posts={ALUMNI_POSTS} authors={ALUMNI} />
            </div>

            <aside>
              <div className="post-cta">
                <h3>มีข่าวดีอยากเล่า?</h3>
                <p>ศิษย์เก่าทุกคนส่งข่าวของตัวเองขึ้นเว็บได้ ไม่ต้องผ่านเจ้าหน้าที่</p>
                <ul>
                  <li>เลื่อนตำแหน่ง เปลี่ยนงาน เรียนต่อ</li>
                  <li>รางวัลและความสำเร็จ</li>
                  <li>เปิดธุรกิจหรือผลงานใหม่</li>
                  <li>นัดรวมรุ่นและกิจกรรมของรุ่น</li>
                </ul>
                <a href="#" className="btn btn-gold btn-sm">
                  เข้าสู่ระบบเพื่อส่งข่าว
                </a>
              </div>

              <div className="pdpa-note">
                <strong>การตรวจสอบเนื้อหา:</strong> ข่าวทุกชิ้นผ่านการตรวจสอบก่อนเผยแพร่
                โดยทั่วไปใช้เวลาไม่เกิน 1 วันทำการ ผู้ที่ถูกแท็กในข่าวสามารถปฏิเสธการแท็กได้
                และ<strong>ข่าวไว้อาลัยต้องผ่านการตรวจสอบเสมอ</strong>โดยไม่มีข้อยกเว้น
              </div>

              <div className="card" style={{ marginTop: "18px" }}>
                <div className="card-body">
                  <h3 style={{ fontSize: ".95rem" }}>ข่าวศิษย์เก่ายอดนิยมเดือนนี้</h3>
                  <ul style={{ fontSize: ".9rem" }}>
                    <li style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                      <a href="#">รางวัลวิศวกรดีเด่นระดับภูมิภาค</a>
                    </li>
                    <li style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                      <a href="#">เปิดรับสหกิจศึกษา 12 อัตรา</a>
                    </li>
                    <li style={{ padding: "8px 0" }}>
                      <a href="#">นัดรวมรุ่น 2555 ครบรอบ 14 ปี</a>
                    </li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
