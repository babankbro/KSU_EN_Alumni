import "server-only";
import type { PoolClient } from "pg";
import { getPool, query } from "./db";
import { removeObject } from "./storage";
import { parseCsv } from "./csv";

/**
 * Data stewardship for admins: import (FR-ADM-01), duplicate merge
 * (FR-ADM-02) and erasure on request (FR-ADM-08, NFR-PDPA-03).
 */

/* ================= erasure ================= */

/**
 * Removes everything that identifies a person, keeping only the programme
 * and years so aggregate statistics stay correct. Stored files are deleted
 * from object storage too. The audit log keeps that an erasure happened.
 */
export async function anonymizeAlumni(alumniId: string): Promise<{ files: number }> {
  const client = await getPool().connect();
  let keys: string[] = [];
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ object_key: string }>(
      `SELECT f.object_key FROM file_object f
       WHERE f.owner_alumni_id = $1
          OR f.id IN (SELECT photo_file_id FROM alumni WHERE id = $1)
          OR f.id IN (SELECT photo_file_id FROM registration_request WHERE alumni_id = $1)`,
      [alumniId],
    );
    keys = rows.map((r) => r.object_key);
    await client.query(
      `DELETE FROM file_object WHERE owner_alumni_id = $1
          OR id IN (SELECT photo_file_id FROM alumni WHERE id = $1)
          OR id IN (SELECT photo_file_id FROM registration_request WHERE alumni_id = $1)`,
      [alumniId],
    );
    for (const sql of [
      `DELETE FROM alumni_contact WHERE alumni_id = $1`,
      `DELETE FROM employment WHERE alumni_id = $1`,
      `DELETE FROM alumni_skill WHERE alumni_id = $1`,
      `DELETE FROM alumni_former_name WHERE alumni_id = $1`,
      `DELETE FROM alumni_post WHERE author_id = $1`,
      `DELETE FROM alumni_post_tag WHERE alumni_id = $1`,
      `DELETE FROM kb_article WHERE author_id = $1`,
      `DELETE FROM event_registration WHERE alumni_id = $1`,
      `DELETE FROM event_order WHERE alumni_id = $1`,
      `UPDATE job_post SET posted_by = NULL WHERE posted_by = $1`,
      `UPDATE award_nomination SET nominee_alumni_id = NULL, nominee_name = 'ข้อมูลถูกลบตามคำขอ', nominee_detail = NULL WHERE nominee_alumni_id = $1`,
      `UPDATE registration_request SET payload = '{}'::jsonb, photo_file_id = NULL WHERE alumni_id = $1`,
      `UPDATE survey_response SET alumni_id = NULL WHERE alumni_id = $1`,
      `UPDATE employer_invite SET alumni_id = NULL, employer_name = NULL, employer_email = NULL WHERE alumni_id = $1`,
      `DELETE FROM alumni_post_comment WHERE account_id IN (SELECT id FROM account WHERE alumni_id = $1)`,
      `DELETE FROM notification WHERE account_id IN (SELECT id FROM account WHERE alumni_id = $1)`,
      `DELETE FROM account_session WHERE account_id IN (SELECT id FROM account WHERE alumni_id = $1)`,
      `DELETE FROM account_token WHERE account_id IN (SELECT id FROM account WHERE alumni_id = $1)`,
    ]) {
      await client.query(sql, [alumniId]);
    }
    await client.query(
      `UPDATE account SET email = 'erased-' || id || '@invalid', password_hash = NULL, line_user_id = NULL,
              display_name = 'บัญชีที่ถูกลบ', is_active = false, alumni_id = NULL
       WHERE alumni_id = $1`,
      [alumniId],
    );
    await client.query(
      `UPDATE alumni SET title_th = '', first_name_th = 'ข้อมูลถูกลบตามคำขอ', last_name_th = '', first_name_en = NULL,
              last_name_en = NULL, nickname = NULL, birth_date = NULL, id_last4_hash = NULL, student_code = NULL,
              photo_file_id = NULL, is_notable = false, notable_citation = NULL, completeness_score = 0, anonymized_at = now()
       WHERE id = $1`,
      [alumniId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  // Objects go after the commit: a failed removal leaves an orphan, never a dangling row.
  let removed = 0;
  for (const k of keys) {
    try {
      await removeObject(k);
      removed++;
    } catch (err) {
      console.error("[erase] object removal failed", k, err);
    }
  }
  return { files: removed };
}

/* ================= import ================= */

export const IMPORT_COLUMNS = [
  "student_code", "title_th", "first_name_th", "last_name_th", "program_code", "admission_year", "graduation_year", "birth_date", "id_last4",
] as const;

export interface ImportResult {
  batchId: number;
  total: number;
  inserted: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

const THAI = /^[฀-๿\s.'’-]+$/;

/**
 * Registrar CSV → unclaimed alumni records. A row whose student code already
 * exists is skipped (never overwritten); invalid rows are reported by line.
 * id_last4 is hashed on the way in and never stored as given.
 */
export async function importAlumniCsv(text: string, filename: string, adminId: string): Promise<ImportResult> {
  const rows = parseCsv(text);
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const missing = IMPORT_COLUMNS.filter((c) => !["graduation_year", "birth_date", "id_last4", "title_th"].includes(c) && !header.includes(c));
  if (missing.length) throw new Error(`ไม่พบคอลัมน์: ${missing.join(", ")}`);
  if (rows.length > 5000) throw new Error("นำเข้าได้ครั้งละไม่เกิน 5,000 แถว");
  const col = (r: string[], name: string) => (r[header.indexOf(name)] ?? "").trim();

  const programs = new Map((await query<{ code: string; id: number }>(`SELECT code, id FROM program`)).map((p) => [p.code, p.id]));
  const errors: ImportResult["errors"] = [];
  let inserted = 0;
  let skipped = 0;

  const client = await getPool().connect();
  let batchId = 0;
  try {
    await client.query("BEGIN");
    const { rows: [b] } = await client.query<{ id: number }>(
      `INSERT INTO import_batch (filename, total, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [filename.slice(0, 200), rows.length, adminId],
    );
    batchId = b.id;
    for (const [i, r] of rows.entries()) {
      const line = i + 2;
      const code = col(r, "student_code");
      const first = col(r, "first_name_th");
      const last = col(r, "last_name_th");
      const programId = programs.get(col(r, "program_code"));
      const adm = Number(col(r, "admission_year"));
      const grad = col(r, "graduation_year") ? Number(col(r, "graduation_year")) : null;
      const birth = col(r, "birth_date");
      const last4 = col(r, "id_last4");
      const problem =
        !/^[0-9A-Za-z-]{4,20}$/.test(code) ? "รหัสนักศึกษาไม่ถูกต้อง"
        : !first || !THAI.test(first) || !last || !THAI.test(last) ? "ชื่อ-นามสกุลต้องเป็นอักษรไทย"
        : !programId ? `ไม่รู้จักรหัสหลักสูตร “${col(r, "program_code")}”`
        : !Number.isInteger(adm) || adm < 2500 || adm > 2600 ? "ปีที่เข้าศึกษาต้องเป็น พ.ศ."
        : grad !== null && (!Number.isInteger(grad) || grad < adm) ? "ปีที่จบไม่ถูกต้อง"
        : birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth) ? "วันเกิดต้องเป็น YYYY-MM-DD (ค.ศ.)"
        : last4 && !/^\d{4}$/.test(last4) ? "id_last4 ต้องเป็นตัวเลข 4 หลัก"
        : null;
      if (problem) {
        errors.push({ line, message: problem });
        continue;
      }
      const res = await insertImported(client, {
        code, title: col(r, "title_th") || "", first, last, programId: programId!, adm, grad, birth: birth || null, last4: last4 || null, batchId,
      });
      if (res) inserted++;
      else skipped++;
    }
    await client.query(
      `UPDATE import_batch SET inserted = $2, skipped = $3, errors = $4::jsonb WHERE id = $1`,
      [batchId, inserted, skipped, JSON.stringify(errors.slice(0, 500))],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return { batchId, total: rows.length, inserted, skipped, errors };
}

async function insertImported(
  client: PoolClient,
  v: { code: string; title: string; first: string; last: string; programId: number; adm: number; grad: number | null; birth: string | null; last4: string | null; batchId: number },
): Promise<boolean> {
  const { rows } = await client.query(
    `INSERT INTO alumni (student_code, title_th, first_name_th, last_name_th, program_id, admission_year, graduation_year,
                         birth_date, id_last4_hash, claim_status, import_batch_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date,
             CASE WHEN $9::text IS NULL THEN NULL ELSE crypt($9::text, gen_salt('bf', 10)) END, 'unclaimed', $10)
     ON CONFLICT (student_code) DO NOTHING RETURNING id`,
    [v.code, v.title, v.first, v.last, v.programId, v.adm, v.grad, v.birth, v.last4, v.batchId],
  );
  return rows.length > 0;
}

/* ================= duplicates and merge ================= */

export interface DuplicatePair {
  a: { id: string; name: string; code: string | null; status: string; cohort: number; program: string };
  b: { id: string; name: string; code: string | null; status: string; cohort: number; program: string };
  score: number;
  reason: string;
}

/**
 * Candidate pairs: same current programme, admission years at most one
 * apart, and very similar names (current or former). Never merged
 * automatically — an admin confirms each pair.
 */
export async function findDuplicates(limit = 50): Promise<DuplicatePair[]> {
  const rows = await query<{
    a_id: string; a_name: string; a_code: string | null; a_status: string; a_cohort: number; a_prog: string;
    b_id: string; b_name: string; b_code: string | null; b_status: string; b_cohort: number; b_prog: string;
    score: number; same_birth: boolean;
  }>(
    `WITH p AS (
       SELECT a.id, a.first_name_th || ' ' || a.last_name_th AS name, a.student_code, a.claim_status::text AS status,
              a.admission_year, a.birth_date, pr.current_id, pr.current_name_th
       FROM alumni a JOIN program_resolved pr ON pr.id = a.program_id
       WHERE a.anonymized_at IS NULL AND a.claim_status <> 'rejected'
     )
     SELECT x.id AS a_id, x.name AS a_name, x.student_code AS a_code, x.status AS a_status, x.admission_year AS a_cohort, x.current_name_th AS a_prog,
            y.id AS b_id, y.name AS b_name, y.student_code AS b_code, y.status AS b_status, y.admission_year AS b_cohort, y.current_name_th AS b_prog,
            similarity(x.name, y.name) AS score, (x.birth_date IS NOT NULL AND x.birth_date = y.birth_date) AS same_birth
     FROM p x JOIN p y ON x.id < y.id AND x.current_id = y.current_id AND abs(x.admission_year - y.admission_year) <= 1
     WHERE NOT (x.student_code IS NOT NULL AND y.student_code IS NOT NULL AND x.student_code <> y.student_code)
       AND (similarity(x.name, y.name) > 0.6
            OR EXISTS (SELECT 1 FROM alumni_former_name f WHERE f.alumni_id = x.id AND similarity(f.first_name_th || ' ' || f.last_name_th, y.name) > 0.7)
            OR EXISTS (SELECT 1 FROM alumni_former_name f WHERE f.alumni_id = y.id AND similarity(f.first_name_th || ' ' || f.last_name_th, x.name) > 0.7))
     ORDER BY score DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    a: { id: r.a_id, name: r.a_name, code: r.a_code, status: r.a_status, cohort: r.a_cohort, program: r.a_prog },
    b: { id: r.b_id, name: r.b_name, code: r.b_code, status: r.b_status, cohort: r.b_cohort, program: r.b_prog },
    score: r.score,
    reason: r.same_birth ? "ชื่อใกล้เคียง · วันเกิดตรงกัน" : r.score > 0.6 ? "ชื่อใกล้เคียง" : "ตรงกับชื่อเดิม",
  }));
}

/**
 * Moves everything from `mergedId` onto `keptId`, keeps a JSON snapshot of
 * the removed row, then deletes it. Fields the kept record lacks are filled
 * from the merged one; the kept record's own values always win.
 */
export async function mergeAlumni(keptId: string, mergedId: string, adminId: string): Promise<void> {
  if (keptId === mergedId) throw new Error("same record");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows: [m] } = await client.query(`SELECT * FROM alumni WHERE id = $1 FOR UPDATE`, [mergedId]);
    const { rows: [k] } = await client.query(`SELECT id FROM alumni WHERE id = $1 FOR UPDATE`, [keptId]);
    if (!m || !k) throw new Error("record not found");
    const snapshot = {
      alumni: m,
      contact: (await client.query(`SELECT * FROM alumni_contact WHERE alumni_id = $1`, [mergedId])).rows[0] ?? null,
    };
    // A unique student code moves with the row only if the kept one has none.
    await client.query(`UPDATE alumni SET student_code = NULL WHERE id = $1`, [mergedId]);
    await client.query(
      `UPDATE alumni k SET
         student_code = coalesce(k.student_code, $2), birth_date = coalesce(k.birth_date, $3::date),
         id_last4_hash = coalesce(k.id_last4_hash, $4), graduation_year = coalesce(k.graduation_year, $5),
         first_name_en = coalesce(k.first_name_en, $6), last_name_en = coalesce(k.last_name_en, $7),
         nickname = coalesce(k.nickname, $8), photo_file_id = coalesce(k.photo_file_id, $9),
         claim_status = CASE WHEN k.claim_status = 'verified' OR $10 = 'verified' THEN 'verified'::claim_status ELSE k.claim_status END
       WHERE k.id = $1`,
      [keptId, m.student_code, m.birth_date, m.id_last4_hash, m.graduation_year, m.first_name_en, m.last_name_en, m.nickname, m.photo_file_id, m.claim_status],
    );
    // The merged person's name becomes a former name, so searches still find them.
    await client.query(
      `INSERT INTO alumni_former_name (alumni_id, first_name_th, last_name_th)
       SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM alumni WHERE id = $1 AND first_name_th = $2 AND last_name_th = $3)`,
      [keptId, m.first_name_th, m.last_name_th],
    );
    for (const sql of [
      `INSERT INTO alumni_contact (alumni_id, email, phone, line_id, province, country, visibility, field_visibility)
       SELECT $1, email, phone, line_id, province, country, visibility, field_visibility FROM alumni_contact WHERE alumni_id = $2
       ON CONFLICT (alumni_id) DO NOTHING`,
      `UPDATE employment SET alumni_id = $1 WHERE alumni_id = $2`,
      `INSERT INTO alumni_skill (alumni_id, skill_id) SELECT $1, skill_id FROM alumni_skill WHERE alumni_id = $2 ON CONFLICT DO NOTHING`,
      `UPDATE alumni_former_name SET alumni_id = $1 WHERE alumni_id = $2`,
      `UPDATE consent_log SET alumni_id = $1 WHERE alumni_id = $2`,
      `UPDATE registration_request SET alumni_id = $1 WHERE alumni_id = $2`,
      `UPDATE alumni_post SET author_id = $1 WHERE author_id = $2`,
      `INSERT INTO alumni_post_tag (post_id, alumni_id, declined) SELECT post_id, $1, declined FROM alumni_post_tag WHERE alumni_id = $2 ON CONFLICT DO NOTHING`,
      `UPDATE kb_article SET author_id = $1 WHERE author_id = $2`,
      `UPDATE job_post SET posted_by = $1 WHERE posted_by = $2`,
      `INSERT INTO event_registration (event_id, alumni_id, registered_at) SELECT event_id, $1, registered_at FROM event_registration WHERE alumni_id = $2 ON CONFLICT DO NOTHING`,
      `UPDATE event_order SET alumni_id = $1 WHERE alumni_id = $2`,
      `UPDATE award_nomination SET nominee_alumni_id = $1 WHERE nominee_alumni_id = $2`,
      `UPDATE survey_response SET alumni_id = $1 WHERE alumni_id = $2
         AND NOT EXISTS (SELECT 1 FROM survey_response x WHERE x.alumni_id = $1 AND x.survey_id = survey_response.survey_id)`,
      `UPDATE employer_invite SET alumni_id = $1 WHERE alumni_id = $2`,
      `UPDATE pdpa_request SET alumni_id = $1 WHERE alumni_id = $2`,
      `UPDATE file_object SET owner_alumni_id = $1 WHERE owner_alumni_id = $2`,
      // One account per alumnus: keep the kept record's, otherwise move the merged one over.
      `UPDATE account SET alumni_id = $1 WHERE alumni_id = $2 AND NOT EXISTS (SELECT 1 FROM account WHERE alumni_id = $1)`,
      `UPDATE account SET alumni_id = NULL WHERE alumni_id = $2 AND alumni_id IS DISTINCT FROM $1::uuid`,
    ]) {
      await client.query(sql, [keptId, mergedId]);
    }
    await client.query(
      `INSERT INTO alumni_merge (kept_id, merged_id, merged_snapshot, merged_by) VALUES ($1, $2, $3::jsonb, $4)`,
      [keptId, mergedId, JSON.stringify(snapshot), adminId],
    );
    await client.query(`DELETE FROM alumni WHERE id = $1`, [mergedId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
