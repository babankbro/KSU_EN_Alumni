"use server";

import { redirect } from "next/navigation";
import { query } from "@/lib/server/db";
import { audit, requireAdmin } from "@/lib/server/auth";
import { fromLocalInput } from "@/lib/server/events";
import { parseQuestions } from "@/lib/surveys";
import type { FormState } from "@/lib/form-state";

/** FR-SVY-01 — survey rounds are created and opened by admins and faculty (QA). */

const QA = ["admin", "faculty"] as const;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");

export async function createSurveyAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin([...QA]);
  const title = str(fd, "title");
  const description = str(fd, "description");
  const audience = str(fd, "audience");
  const opensAt = str(fd, "opensAt") ? fromLocalInput(str(fd, "opensAt")) : null;
  const closesAt = str(fd, "closesAt") ? fromLocalInput(str(fd, "closesAt")) : null;
  const copyFrom = Number(str(fd, "copyFrom")) || null;
  const json = str(fd, "questions");

  const fe: Record<string, string> = {};
  if (title.length < 5 || title.length > 200) fe.title = "ชื่อแบบสำรวจต้องยาว 5–200 ตัวอักษร";
  if (!["alumni", "employer"].includes(audience)) fe.audience = "กรุณาเลือกกลุ่มผู้ตอบ";
  if (opensAt && closesAt && closesAt <= opensAt) fe.closesAt = "วันปิดต้องหลังวันเปิด";

  let questions: unknown = null;
  if (json) {
    const parsed = parseQuestions(json);
    if ("error" in parsed) fe.questions = parsed.error;
    else questions = parsed.questions;
  } else if (copyFrom) {
    const [src] = await query<{ questions: unknown; audience: string }>(`SELECT questions, audience FROM survey WHERE id = $1`, [copyFrom]);
    if (!src) fe.copyFrom = "ไม่พบแบบสำรวจต้นแบบ";
    else if (src.audience !== audience) fe.copyFrom = "แบบสำรวจต้นแบบเป็นของกลุ่มผู้ตอบอื่น";
    else questions = src.questions;
  } else fe.questions = "คัดลอกคำถามจากรอบก่อน หรือวางคำถามในรูปแบบ JSON";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  const [row] = await query<{ id: number }>(
    `INSERT INTO survey (title, description, audience, status, opens_at, closes_at, questions, created_by)
     VALUES ($1, NULLIF($2, ''), $3, 'draft', $4, $5, $6::jsonb, $7) RETURNING id`,
    [title, description, audience, opensAt, closesAt, JSON.stringify(questions), session.id],
  );
  await audit(session, "survey.create", "survey", row.id, { title });
  redirect(`/admin/surveys/${row.id}?created=1`);
}

export async function setSurveyStatusAction(fd: FormData): Promise<void> {
  const session = await requireAdmin([...QA]);
  const id = Number(fd.get("surveyId"));
  const status = str(fd, "status");
  if (!["draft", "open", "closed"].includes(status)) redirect("/admin/surveys");
  await query(`UPDATE survey SET status = $2 WHERE id = $1`, [id, status]);
  await audit(session, "survey.status", "survey", id, { status });
  redirect(`/admin/surveys/${id}`);
}
