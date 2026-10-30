"use server";

import { redirect } from "next/navigation";
import { query } from "@/lib/server/db";
import { requireMember } from "@/lib/server/member-auth";
import { storeUpload, UploadError } from "@/lib/server/files";
import { openRound } from "@/lib/server/awards";
import type { FormState } from "@/lib/form-state";

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** FR-AWD-01/02 — a verified alumnus nominates someone, with reasons and evidence. */
export async function nominateAction(_p: FormState, fd: FormData): Promise<FormState> {
  const acc = await requireMember({ alumni: true, verified: true });
  const round = await openRound();
  if (!round) return { error: "ขณะนี้ไม่มีรอบที่เปิดรับการเสนอชื่อ" };

  const picked = fd.getAll("nominee").map(String).find((v) => UUID.test(v)) ?? null;
  const typedName = str(fd, "nomineeName");
  const detail = str(fd, "nomineeDetail").slice(0, 300);
  const reason = str(fd, "reason");

  const fe: Record<string, string> = {};
  let nomineeName = typedName;
  if (picked) {
    const [a] = await query<{ name: string }>(
      `SELECT title_th || first_name_th || ' ' || last_name_th AS name FROM directory_public WHERE id = $1`,
      [picked],
    );
    if (!a) fe.nominee = "ไม่พบบุคคลนี้ในทำเนียบ";
    else nomineeName = a.name;
  }
  if (!nomineeName || nomineeName.length > 150) fe.nomineeName = "เลือกจากทำเนียบ หรือพิมพ์ชื่อ-นามสกุลผู้ถูกเสนอชื่อ";
  if (picked && picked === acc.alumniId) fe.nominee = "เสนอชื่อตนเองไม่ได้";
  if (reason.length < 100 || reason.length > 5000) fe.reason = "เหตุผลและผลงานต้องยาว 100–5,000 ตัวอักษร";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };

  const [{ n }] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM award_nomination WHERE round_id = $1 AND nominator_account_id = $2`,
    [round.id, acc.id],
  );
  if (Number(n) >= 5) return { error: "เสนอชื่อได้ไม่เกิน 5 คนต่อรอบ" };

  let evidenceId: string | null = null;
  const file = fd.get("evidence");
  if (file instanceof File && file.size > 0) {
    try {
      evidenceId = (await storeUpload(file, "nomination", { uploadedBy: `account:${acc.id}`, ownerAlumniId: acc.alumniId })).id;
    } catch (err) {
      if (err instanceof UploadError) return { fieldErrors: { evidence: err.message } };
      throw err;
    }
  }

  await query(
    `INSERT INTO award_nomination (round_id, nominee_alumni_id, nominee_name, nominee_detail, nominator_account_id, reason, evidence_file_id)
     VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7)`,
    [round.id, picked, nomineeName, detail, acc.id, reason, evidenceId],
  );
  redirect("/me/activity?saved=nomination");
}
