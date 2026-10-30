import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import RegistrationForm from "@/components/RegistrationForm";

export const metadata: Metadata = {
  title: "สมัครสมาชิก / Claim โปรไฟล์",
  description:
    "สมัครสมาชิกและยืนยันตัวตนศิษย์เก่า คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์",
};

export default function RegisterPage() {
  return (
    <>
      <PageHead
        crumb="สมัครสมาชิก"
        title="สมัครสมาชิก / Claim โปรไฟล์"
        lead="ใช้เวลาประมาณ 3 นาที — ยืนยันตัวตน ตรวจสอบชื่อ เลือกระดับความเป็นส่วนตัว แล้วส่งใบสมัคร"
      />
      <section className="section">
        <div className="wrap">
          <RegistrationForm />
        </div>
      </section>
    </>
  );
}
