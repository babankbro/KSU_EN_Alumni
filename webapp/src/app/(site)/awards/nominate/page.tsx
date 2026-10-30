import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import TagPicker from "@/components/me/TagPicker";
import { openRound } from "@/lib/server/awards";
import { formatThaiDateOnly } from "@/lib/server/format-server";
import { requireMember } from "@/lib/server/member-auth";
import { nominateAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เสนอชื่อศิษย์เก่าดีเด่น", robots: { index: false } };

export default async function NominatePage() {
  await requireMember({ alumni: true, verified: true });
  const round = await openRound();

  return (
    <>
      <PageHead crumb="ศิษย์เก่าดีเด่น" title="เสนอชื่อศิษย์เก่าดีเด่น" lead={round ? `${round.title} · ปิดรับ ${formatThaiDateOnly(round.closesAt)}` : "ยังไม่เปิดรับ"} />
      <section className="section">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="small"><Link href="/awards">← ทำเนียบศิษย์เก่าดีเด่น</Link></p>
          {round ? (
            <ActionForm action={nominateAction} encType="multipart/form-data" submitLabel="ส่งการเสนอชื่อ" pendingLabel="กำลังส่ง…">
              <TagPicker initial={[]} name="nominee" max={1} label="ผู้ถูกเสนอชื่อ — ค้นจากทำเนียบ" hint="ถ้าไม่พบในทำเนียบ พิมพ์ชื่อในช่องถัดไปแทน" />
              <Field name="nomineeName" label="หรือพิมพ์ชื่อ-นามสกุล (กรณีไม่พบในทำเนียบ)" maxLength={150} />
              <Field name="nomineeDetail" label="รุ่น / สาขา / ตำแหน่งปัจจุบัน (ถ้าทราบ)" maxLength={300} />
              <Field as="textarea" name="reason" label="เหตุผลและผลงานที่โดดเด่น" rows={8} maxLength={5000} required hint="อย่างน้อย 100 ตัวอักษร ระบุผลงาน รางวัล หรือคุณประโยชน์ต่อวิชาชีพ สังคม และคณะ" />
              <div className="field">
                <label htmlFor="evidence">เอกสารประกอบ (PDF หรือรูปภาพ ไม่เกิน 10 MB)</label>
                <input id="evidence" name="evidence" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
                <p className="field-hint">เอกสารนี้เห็นได้เฉพาะกรรมการและเจ้าหน้าที่</p>
              </div>
            </ActionForm>
          ) : (
            <p className="muted">ขณะนี้ยังไม่มีรอบที่เปิดรับการเสนอชื่อ</p>
          )}
        </div>
      </section>
    </>
  );
}
