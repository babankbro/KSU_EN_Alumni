"use server";

import { getPool } from "@/lib/server/db";
import { getSurvey, respondentFacts } from "@/lib/server/surveys";
import { sha256 } from "@/lib/server/tokens";
import { validateAnswers, type Answers } from "@/lib/surveys";
import type { FormState } from "@/lib/form-state";

/** FR-SVY-04 — employer response through a one-time invite token. */
export async function submitEmployerSurveyAction(_p: FormState, fd: FormData): Promise<FormState> {
  const token = typeof fd.get("token") === "string" ? (fd.get("token") as string) : "";
  let raw: Answers = {};
  try {
    raw = JSON.parse(String(fd.get("answers") ?? "{}"));
  } catch {
    /* empty answers fail validation below */
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Lock the invite so a double submit cannot record two responses.
    const { rows: [inv] } = await client.query<{ id: number; survey_id: number; alumni_id: string | null }>(
      `SELECT id, survey_id, alumni_id FROM employer_invite
       WHERE token_hash = $1 AND responded_at IS NULL AND expires_at > now() FOR UPDATE`,
      [sha256(token)],
    );
    const survey = inv ? await getSurvey(inv.survey_id, { openOnly: true }) : null;
    if (!inv || !survey || survey.audience !== "employer") {
      await client.query("ROLLBACK");
      return { error: "ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว" };
    }
    const { answers, errors } = validateAnswers(survey.questions, raw);
    if (Object.keys(errors).length) {
      await client.query("ROLLBACK");
      return { error: "กรุณาตอบข้อที่จำเป็นให้ครบ", fieldErrors: errors };
    }
    const facts = inv.alumni_id ? await respondentFacts(inv.alumni_id) : { programId: null, graduationYear: null, yearsSinceGrad: null };
    // alumni_id stays NULL on employer rows: the per-alumnus unique index is for
    // the graduate's own survey; the link to the graduate is employer_invite_id.
    await client.query(
      `INSERT INTO survey_response (survey_id, employer_invite_id, answers, program_id, graduation_year, years_since_grad)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
      [survey.id, inv.id, JSON.stringify(answers), facts.programId, facts.graduationYear, facts.yearsSinceGrad],
    );
    await client.query(`UPDATE employer_invite SET responded_at = now() WHERE id = $1`, [inv.id]);
    await client.query("COMMIT");
    return { ok: "ขอบคุณที่สละเวลาให้ข้อมูล คำตอบของท่านได้รับการบันทึกแล้ว" };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[survey] employer submit", err);
    return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  } finally {
    client.release();
  }
}
