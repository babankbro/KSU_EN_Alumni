import type { Metadata } from "next";
import PageHead from "@/components/PageHead";

export const metadata: Metadata = {
  title: "ติดต่อเรา",
  description: "ติดต่องานศิษย์เก่าสัมพันธ์ คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์",
};

const ITEMS = [
  {
    ico: "📍",
    label: "งานศิษย์เก่าสัมพันธ์ คณะวิศวกรรมศาสตร์",
    value: "มหาวิทยาลัยกาฬสินธุ์ อำเภอเมือง จังหวัดกาฬสินธุ์ 46000",
  },
  { ico: "☎", label: "โทรศัพท์", value: "043-602-053" },
  { ico: "✉", label: "อีเมล", value: "alumni.eng@ksu.ac.th" },
  { ico: "💬", label: "LINE Official Account", value: "@ksu-eng-alumni" },
];

export default function ContactPage() {
  return (
    <>
      <PageHead crumb="ติดต่อ" title="ติดต่อเรา" />
      <section className="section">
        <div className="wrap">
          <div className="contact-grid">
            <div>
              {ITEMS.map((i) => (
                <div className="contact-item" key={i.label}>
                  <div className="ico" aria-hidden="true">{i.ico}</div>
                  <div>
                    <strong>{i.label}</strong>
                    <span>{i.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="map-placeholder">
              แผนที่ตั้งคณะวิศวกรรมศาสตร์
              <br />
              (ใส่แผนที่ฝังในเวอร์ชันจริง)
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
