"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool, query } from "@/lib/server/db";
import { audit, requireAdmin } from "@/lib/server/auth";
import { fromLocalInput } from "@/lib/server/events";
import type { FormState } from "@/lib/form-state";

/** Award rounds and committee decisions (FR-AWD-01/03/04): admins and faculty. */

const COMMITTEE = ["admin", "faculty"] as const;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");

export async function createRoundAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin([...COMMITTEE]);
  const title = str(fd, "title");
  const description = str(fd, "description");
  const opensAt = fromLocalInput(str(fd, "opensAt"));
  const closesAt = fromLocalInput(str(fd, "closesAt"));
  const fe: Record<string, string> = {};
  if (title.length < 5 || title.length > 200) fe.title = "ชื่อรอบต้องยาว 5–200 ตัวอักษร";
  if (!opensAt) fe.opensAt = "กรุณาระบุวันเปิดรับ";
  if (!closesAt) fe.closesAt = "กรุณาระบุวันปิดรับ";
  if (opensAt && closesAt && closesAt <= opensAt) fe.closesAt = "วันปิดรับต้องหลังวันเปิดรับ";
  if (Object.keys(fe).length) return { error: "กรุณาตรวจสอบข้อมูล", fieldErrors: fe };
  const [row] = await query<{ id: number }>(
    `INSERT INTO award_round (title, description, opens_at, closes_at, created_by) VALUES ($1, NULLIF($2, ''), $3, $4, $5) RETURNING id`,
    [title, description, opensAt, closesAt, session.id],
  );
  await audit(session, "award.round_create", "award_round", row.id, { title });
  revalidatePath("/awards");
  return { ok: `สร้างรอบ “${title}” แล้ว` };
}

const STATUSES = ["submitted", "shortlisted", "awarded", "not_selected"];

/**
 * Records the committee's decision. Awarding someone who is in the alumni
 * records also marks them notable, so they appear on the directory and home
 * page (FR-AWD-04); un-awarding clears it unless another award remains.
 */
export async function decideNominationAction(fd: FormData): Promise<void> {
  const session = await requireAdmin([...COMMITTEE]);
  const id = Number(fd.get("nominationId"));
  const status = str(fd, "status");
  const note = str(fd, "committeeNote").slice(0, 2000);
  const citation = str(fd, "citation").slice(0, 500);
  if (!Number.isInteger(id) || !STATUSES.includes(status)) redirect("/admin/awards");
  const back = (round: number, done: string) => redirect(`/admin/awards/${round}?done=${done}#n${id}`);

  const client = await getPool().connect();
  let roundId = 0;
  try {
    await client.query("BEGIN");
    const { rows: [n] } = await client.query<{ round_id: number; nominee_alumni_id: string | null }>(
      `SELECT round_id, nominee_alumni_id FROM award_nomination WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!n) {
      await client.query("ROLLBACK");
      redirect("/admin/awards");
    }
    roundId = n.round_id;
    if (status === "awarded" && !citation) {
      await client.query("ROLLBACK");
      back(roundId, "need_citation");
    }
    await client.query(
      `UPDATE award_nomination SET status = $2, committee_note = NULLIF($3, ''), citation = NULLIF($4, ''),
              decided_by = $5, decided_at = now() WHERE id = $1`,
      [id, status, note, citation, session.id],
    );
    if (n.nominee_alumni_id) {
      await client.query(
        `UPDATE alumni a SET
           is_notable = EXISTS (SELECT 1 FROM award_nomination x WHERE x.nominee_alumni_id = a.id AND x.status = 'awarded'),
           notable_citation = (SELECT x.citation FROM award_nomination x WHERE x.nominee_alumni_id = a.id AND x.status = 'awarded'
                               ORDER BY x.decided_at DESC LIMIT 1)
         WHERE a.id = $1`,
        [n.nominee_alumni_id],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await audit(session, "award.decide", "award_nomination", id, { status });
  revalidatePath("/awards");
  back(roundId, "saved");
}
