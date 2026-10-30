import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import Completeness from "@/components/Completeness";

export const metadata: Metadata = {
  title: "สิทธิประโยชน์สำหรับศิษย์เก่า",
  description:
    "บัตรศิษย์เก่าดิจิทัลและสิทธิประโยชน์สำหรับศิษย์เก่าคณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์",
};

const PRIVILEGES = [
  { ico: "📚", title: "ใช้บริการห้องสมุด", body: "เข้าใช้ห้องสมุดและฐานข้อมูลอิเล็กทรอนิกส์ของมหาวิทยาลัย" },
  { ico: "🎓", title: "อบรมและสัมมนา", body: "เข้าร่วมกิจกรรมพัฒนาทักษะที่คณะจัดในอัตราศิษย์เก่า" },
  { ico: "💼", title: "ประกาศรับสมัครงาน", body: "ประกาศรับสมัครงานหรือฝึกงานถึงรุ่นน้องได้โดยตรง" },
  { ico: "📣", title: "ส่งข่าวของตัวเอง", body: "เผยแพร่ข่าวความก้าวหน้าและกิจกรรมของรุ่นบนหน้าเว็บ" },
];

export default function PrivilegesPage() {
  return (
    <>
      <PageHead
        crumb="สิทธิประโยชน์"
        title="สิทธิประโยชน์สำหรับศิษย์เก่า"
        lead="ยืนยันตัวตนเพื่อรับบัตรศิษย์เก่าดิจิทัลและสิทธิประโยชน์จากคณะ"
      />

      <section className="section">
        <div className="wrap">
          <div className="grid priv-layout">
            <div className="grid grid-2">
              {PRIVILEGES.map((p) => (
                <div className="card privilege" key={p.title}>
                  <div className="ico" aria-hidden="true">{p.ico}</div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="idcard">
                <div className="row">
                  <div>
                    <div className="label">KSU Engineering Alumni</div>
                    <p className="name">นายอนุชา พรมมา</p>
                    <p className="sub">รุ่น 2560 · วิศวกรรมคอมพิวเตอร์</p>
                  </div>
                  <div className="qr" aria-hidden="true">QR</div>
                </div>
                <div className="foot">
                  <span>รหัสสมาชิก ENG-2560-0142</span>
                  <span>ยืนยันตัวตนแล้ว ✓</span>
                </div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <Completeness score={92} />
              </div>

              <p style={{ marginTop: "14px", fontSize: ".88rem", color: "var(--muted)" }}>
                บัตรศิษย์เก่าดิจิทัลแสดงผลบนมือถือ ใช้แสดงตนในกิจกรรมของคณะได้ทันที
              </p>
              <a href="#" className="btn btn-primary">ยืนยันตัวตนเพื่อรับบัตร</a>
            </div>
          </div>

          <div className="pdpa-note">
            <strong>สิทธิของเจ้าของข้อมูล:</strong> ศิษย์เก่าสามารถขอสำเนาข้อมูลของตนเอง
            แก้ไขข้อมูลให้ถูกต้อง ถอนความยินยอม หรือขอให้ระงับการใช้ข้อมูลได้ทุกเมื่อ
            ผ่านหน้าโปรไฟล์หรือติดต่อเจ้าหน้าที่งานศิษย์เก่าสัมพันธ์
          </div>
        </div>
      </section>
    </>
  );
}
