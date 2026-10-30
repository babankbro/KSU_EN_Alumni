"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/server/db";
import { audit, requireAdmin } from "@/lib/server/auth";
import { enqueue, sendEmail } from "@/lib/server/notify";
import { anonymizeAlumni, importAlumniCsv, mergeAlumni } from "@/lib/server/data-admin";
import type { FormState } from "@/lib/form-state";

/** Personal-data operations — admins only, every one audited. */

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ================= PDPA requests (FR-ADM-08) ================= */

const STATUS_TEXT: Record<string, string> = {
  in_progress: "คำขอของคุณกำลังดำเนินการ",
  done: "คำขอของคุณดำเนินการเรียบร้อยแล้ว",
  rejected: "คำขอของคุณไม่สามารถดำเนินการได้",
};

export async function handlePdpaRequestAction(fd: FormData): Promise<void> {
  const session = await requireAdmin("admin");
  const requestId = Number(str(fd, "requestId"));
  const status = str(fd, "status");
  const response = str(fd, "response").slice(0, 2000);
  const erase = fd.get("erase") === "on";
  if (!["in_progress", "done", "rejected"].includes(status)) redirect("/admin/pdpa?done=invalid");
  if (status === "rejected" && !response) redirect(`/admin/pdpa?done=need_reason#r${requestId}`);

  const [req] = await query<{ alumni_id: string | null; account_id: string | null; type: string; status: string }>(
    `SELECT alumni_id, account_id, type::text AS type, status::text AS status FROM pdpa_request WHERE id = $1`,
    [requestId],
  );
  if (!req) redirect("/admin/pdpa?done=invalid");

  // Erasure is a separate, explicit confirmation on a delete request.
  if (erase) {
    if (req.type !== "delete" || !req.alumni_id || fd.get("confirmErase") !== "ลบข้อมูล") redirect(`/admin/pdpa?done=need_confirm#r${requestId}`);
    // Tell the person now: erasure removes the address and any queued mail.
    const [acc] = req.account_id ? await query<{ email: string }>(`SELECT email FROM account WHERE id = $1`, [req.account_id]) : [];
    if (acc) {
      await sendEmail(acc.email, "ข้อมูลของคุณถูกลบตามคำขอแล้ว — ระบบศิษย์เก่าวิศวกรรมศาสตร์ ม.กาฬสินธุ์",
        `${response || "ระบบลบข้อมูลส่วนบุคคลของคุณตามที่ร้องขอเรียบร้อยแล้ว"}

บัญชีของคุณถูกปิดแล้ว อีเมลนี้เป็นข้อความสุดท้ายที่ระบบจะส่งถึงคุณ
`,
      ).catch((err) => console.error("[pdpa] farewell mail", err));
    }
    const { files } = await anonymizeAlumni(req.alumni_id);
    await audit(session, "pdpa.erase", "alumni", req.alumni_id, { requestId, files });
  } else if (req.account_id) {
    await enqueue("account", [req.account_id], {
      title: STATUS_TEXT[status],
      body: response || "ดูรายละเอียดได้ที่หน้า “ข้อมูลของฉัน (PDPA)”",
      link: "/me/data",
    });
  }
  await query(
    `UPDATE pdpa_request SET status = $2::request_status, response = NULLIF($3, ''), handled_by = $4, handled_at = now() WHERE id = $1`,
    [requestId, status, response, session.id],
  );
  await audit(session, "pdpa.handle", "pdpa_request", requestId, { type: req.type, status });
  revalidatePath("/admin/pdpa");
  redirect(`/admin/pdpa?done=${erase ? "erased" : "saved"}`);
}

/* ================= import (FR-ADM-01) ================= */

export async function importCsvAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin("admin");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { file: "กรุณาเลือกไฟล์ CSV" } };
  if (file.size > 5 * 1024 * 1024) return { fieldErrors: { file: "ไฟล์ต้องไม่เกิน 5 MB" } };
  if (!/\.csv$/i.test(file.name)) return { fieldErrors: { file: "รองรับเฉพาะไฟล์ .csv (UTF-8)" } };
  try {
    const r = await importAlumniCsv(await file.text(), file.name, session.id);
    await audit(session, "member.import", "import_batch", r.batchId, { total: r.total, inserted: r.inserted, skipped: r.skipped, errors: r.errors.length });
    revalidatePath("/admin/import");
    const errs = r.errors.slice(0, 8).map((e) => `บรรทัด ${e.line}: ${e.message}`).join(" · ");
    return r.errors.length
      ? { ok: `นำเข้า ${r.inserted} ระเบียน · ข้าม ${r.skipped} (รหัสซ้ำ)`, error: `มีข้อผิดพลาด ${r.errors.length} แถว — ${errs}${r.errors.length > 8 ? " …" : ""}` }
      : { ok: `นำเข้า ${r.inserted} ระเบียน · ข้าม ${r.skipped} (รหัสซ้ำ) · ไม่มีข้อผิดพลาด` };
  } catch (err) {
    console.error("[import]", err);
    return { error: err instanceof Error && /[฀-๿]/.test(err.message) ? err.message : "นำเข้าไม่สำเร็จ — ตรวจสอบรูปแบบไฟล์" };
  }
}

/* ================= merge (FR-ADM-02) ================= */

export async function mergeAction(fd: FormData): Promise<void> {
  const session = await requireAdmin("admin");
  const keep = str(fd, "keep");
  const a = str(fd, "a");
  const b = str(fd, "b");
  if (![a, b].every((v) => UUID.test(v)) || (keep !== a && keep !== b) || fd.get("confirm") !== "on") redirect("/admin/duplicates?done=need_confirm");
  const merged = keep === a ? b : a;
  await mergeAlumni(keep, merged, session.id);
  await audit(session, "member.merge", "alumni", keep, { merged });
  revalidatePath("/directory");
  redirect("/admin/duplicates?done=merged");
}
