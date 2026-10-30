import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import { getSettings } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "ติดต่อเรา",
  description: "ติดต่องานศิษย์เก่าสัมพันธ์ คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์",
};

export default async function ContactPage() {
  const settings = await getSettings();
  // Edited from /admin/content → ข้อมูลติดต่อ
  const items = [
    { ico: "📍", label: settings["contact.unit"], value: settings["contact.address"] },
    { ico: "☎", label: "โทรศัพท์", value: settings["contact.phone"] },
    { ico: "✉", label: "อีเมล", value: settings["contact.email"] },
    { ico: "💬", label: "LINE Official Account", value: settings["contact.line"] },
  ].filter((i) => i.value);

  return (
    <>
      <PageHead crumb="ติดต่อ" title="ติดต่อเรา" />
      <section className="section">
        <div className="wrap">
          <div className="contact-grid">
            <div>
              {items.map((i) => (
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
