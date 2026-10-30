import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import SurveyWizard from "@/components/SurveyWizard";
import { query } from "@/lib/server/db";
import { getSurvey } from "@/lib/server/surveys";
import { sha256 } from "@/lib/server/tokens";
import { submitEmployerSurveyAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "แบบสำรวจความพึงพอใจของผู้ใช้บัณฑิต", robots: { index: false } };

/** FR-SVY-04 — the employer's one-time link; no account needed. */
export default async function EmployerSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [inv] = /^[A-Za-z0-9_-]{20,100}$/.test(token)
    ? await query<{ survey_id: number; graduate: string | null; responded: boolean; expired: boolean }>(
        `SELECT i.survey_id, a.first_name_th || ' ' || a.last_name_th AS graduate,
                i.responded_at IS NOT NULL AS responded, i.expires_at < now() AS expired
         FROM employer_invite i LEFT JOIN alumni a ON a.id = i.alumni_id WHERE i.token_hash = $1`,
        [sha256(token)],
      )
    : [];
  const survey = inv && !inv.responded && !inv.expired ? await getSurvey(inv.survey_id, { openOnly: true }) : null;

  return (
    <>
      <PageHead crumb="แบบสำรวจ" title="ความพึงพอใจของผู้ใช้บัณฑิต" lead="คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยกาฬสินธุ์" />
      <section className="section">
        <div className="wrap" style={{ maxWidth: 760 }}>
          {!inv ? (
            <p className="admin-card">ลิงก์นี้ไม่ถูกต้อง</p>
          ) : inv.responded ? (
            <p className="admin-card">ลิงก์นี้ถูกใช้ตอบแบบสำรวจไปแล้ว ขอบคุณที่ให้ความร่วมมือ</p>
          ) : inv.expired || !survey ? (
            <p className="admin-card">ลิงก์นี้หมดอายุหรือแบบสำรวจปิดรับแล้ว</p>
          ) : (
            <>
              <p>
                โปรดประเมินบัณฑิต <strong>{inv.graduate ?? "ของคณะ"}</strong> ที่ทำงานกับหน่วยงานของท่าน ใช้เวลาประมาณ 3 นาที
                คำตอบใช้เพื่อปรับปรุงหลักสูตรและรายงานประกันคุณภาพ และแสดงผลแบบรวมกลุ่มเท่านั้น
              </p>
              <SurveyWizard questions={survey.questions} initial={{}} action={submitEmployerSurveyAction} hidden={{ token }} />
            </>
          )}
        </div>
      </section>
    </>
  );
}
