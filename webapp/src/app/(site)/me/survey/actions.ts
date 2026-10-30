"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/server/db";
import { requireMember } from "@/lib/server/member-auth";
import { getSurvey, listOpenSurveys, respondentFacts } from "@/lib/server/surveys";
import { newToken, appUrl } from "@/lib/server/tokens";
import { sendEmail } from "@/lib/server/notify";
import { hit } from "@/lib/server/rate-limit";
import { validateAnswers, type Answers } from "@/lib/surveys";
import type { FormState } from "@/lib/form-state";

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseAnswers(fd: FormData): Answers {
  try {
    const v = JSON.parse(str(fd, "answers"));
    return v && typeof v === "object" ? (v as Answers) : {};
  } catch {
    return {};
  }
}

/** FR-SVY-02/07 — one response per alumnus per survey, with the timepoint stored. */
export async function submitAlumniSurveyAction(_p: FormState, fd: FormData): Promise<FormState> {
  const acc = await requireMember({ alumni: true, verified: true });
  const survey = await getSurvey(Number(fd.get("surveyId")), { openOnly: true });
  if (!survey || survey.audience !== "alumni" || !acc.alumniId) return { error: "แบบสำรวจนี้ปิดรับแล้ว" };

  const { answers, errors } = validateAnswers(survey.questions, parseAnswers(fd));
  if (Object.keys(errors).length) return { error: "กรุณาตอบข้อที่จำเป็นให้ครบ", fieldErrors: errors };

  const facts = await respondentFacts(acc.alumniId);
  const rows = await query(
    `INSERT INTO survey_response (survey_id, alumni_id, answers, program_id, graduation_year, years_since_grad)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6)
     ON CONFLICT (survey_id, alumni_id) WHERE alumni_id IS NOT NULL DO NOTHING RETURNING id`,
    [survey.id, acc.alumniId, JSON.stringify(answers), facts.programId, facts.graduationYear, facts.yearsSinceGrad],
  );
  revalidatePath("/me/survey");
  if (rows.length === 0) return { ok: "คุณตอบแบบสำรวจนี้ไปแล้ว ขอบคุณครับ/ค่ะ" };
  return { ok: "คำตอบของคุณช่วยให้คณะปรับปรุงหลักสูตรได้ตรงกับการทำงานจริง" };
}

/**
 * FR-SVY-04 — the graduate sends their supervisor a one-time link to the
 * employer survey. The employer needs no account; the link expires in 30 days.
 */
export async function inviteEmployerAction(_p: FormState, fd: FormData): Promise<FormState> {
  const acc = await requireMember({ alumni: true, verified: true });
  const name = str(fd, "employerName");
  const email = str(fd, "employerEmail");
  const fe: Record<string, string> = {};
  if (!name || name.length > 150) fe.employerName = "กรุณาระบุชื่อหัวหน้างานหรือหน่วยงาน";
  if (!EMAIL.test(email) || email.length > 200) fe.employerEmail = "รูปแบบอีเมลไม่ถูกต้อง";
  if (email.toLowerCase() === acc.email.toLowerCase()) fe.employerEmail = "ใช้อีเมลของหัวหน้างาน ไม่ใช่อีเมลของคุณเอง";
  if (Object.keys(fe).length) return { fieldErrors: fe };

  const [survey] = await listOpenSurveys("employer");
  if (!survey) return { error: "ขณะนี้ไม่มีแบบสำรวจผู้ใช้บัณฑิตที่เปิดรับ" };
  if (await hit({ bucket: "employer_invite", max: 3, windowSec: 86400 }, acc.id)) return { error: "ส่งคำเชิญได้วันละไม่เกิน 3 ครั้ง" };

  const { token, hash } = newToken();
  await query(
    `INSERT INTO employer_invite (token_hash, survey_id, alumni_id, employer_name, employer_email, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + interval '30 days')`,
    [hash, survey.id, acc.alumniId, name, email],
  );
  const link = appUrl(`/survey/employer/${token}`);
  await sendEmail(
    email,
    `คำเชิญตอบแบบสำรวจความพึงพอใจของผู้ใช้บัณฑิต — คณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์`,
    `เรียน ${name}\n\n${acc.displayName} บัณฑิตคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยกาฬสินธุ์ ` +
      `ขอความกรุณาท่านตอบแบบสำรวจความพึงพอใจของผู้ใช้บัณฑิต ใช้เวลาประมาณ 3 นาที ไม่ต้องสมัครสมาชิก\n\n${link}\n\n` +
      `ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน 30 วัน คำตอบของท่านใช้เพื่อปรับปรุงหลักสูตรและรายงานประกันคุณภาพเท่านั้น\n`,
  ).catch((err) => console.error("[survey] invite mail", err));
  return { ok: `ส่งคำเชิญไปที่ ${email} แล้ว` };
}
