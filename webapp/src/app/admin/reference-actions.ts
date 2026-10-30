"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query } from "@/lib/server/db";
import { audit, requireAdmin } from "@/lib/server/auth";
import type { FormState } from "@/lib/form-state";

/** Reference data (FR-ADM-05): programmes, skills, job categories — admins only. */

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
const back = (tab: string, done: string): never => redirect(`/admin/reference?tab=${tab}&done=${done}`);

export async function updateProgramAction(fd: FormData): Promise<void> {
  const session = await requireAdmin("admin");
  const programId = Number(str(fd, "programId"));
  const nameTh = str(fd, "nameTh");
  const nameEn = str(fd, "nameEn");
  const status = str(fd, "status");
  const successor = Number(str(fd, "successorId")) || null;
  if (!nameTh || nameTh.length > 150 || !["active", "renamed", "closed", "planned"].includes(status)) back("programs", "invalid");
  if (successor === programId) back("programs", "invalid");
  await query(
    `UPDATE program SET name_th = $2, name_en = NULLIF($3, ''), status = $4::program_status, successor_id = $5,
            verified = $6, source_note = coalesce(NULLIF($7, ''), source_note)
     WHERE id = $1`,
    [programId, nameTh, nameEn, status, successor, fd.get("verified") === "on", str(fd, "sourceNote").slice(0, 300)],
  );
  await audit(session, "reference.program", "program", programId, { nameTh, status, successor });
  revalidatePath("/directory");
  back("programs", "saved");
}

export async function addSkillAction(_p: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin("admin");
  const name = str(fd, "skillName");
  if (!name || name.length > 60) return { fieldErrors: { skillName: "ชื่อทักษะ 1–60 ตัวอักษร" } };
  const rows = await query<{ id: number }>(`INSERT INTO skill (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`, [name]);
  if (!rows.length) return { fieldErrors: { skillName: "มีทักษะนี้แล้ว" } };
  await audit(session, "reference.skill_add", "skill", rows[0].id, { name });
  revalidatePath("/admin/reference");
  return { ok: `เพิ่ม “${name}” แล้ว` };
}

/** Rename, or merge into another skill when the new name already exists. */
export async function updateSkillAction(fd: FormData): Promise<void> {
  const session = await requireAdmin("admin");
  const skillId = Number(str(fd, "skillId"));
  const intent = str(fd, "intent");
  if (intent === "delete") {
    await query(`DELETE FROM skill WHERE id = $1`, [skillId]);
    await audit(session, "reference.skill_delete", "skill", skillId);
    back("skills", "deleted");
  }
  const name = str(fd, "skillName");
  if (!name || name.length > 60) back("skills", "invalid");
  const [existing] = await query<{ id: number }>(`SELECT id FROM skill WHERE name = $1 AND id <> $2`, [name, skillId]);
  if (existing) {
    await query(`INSERT INTO alumni_skill (alumni_id, skill_id) SELECT alumni_id, $2 FROM alumni_skill WHERE skill_id = $1 ON CONFLICT DO NOTHING`, [skillId, existing.id]);
    await query(`INSERT INTO job_post_skill (job_post_id, skill_id) SELECT job_post_id, $2 FROM job_post_skill WHERE skill_id = $1 ON CONFLICT DO NOTHING`, [skillId, existing.id]);
    await query(`DELETE FROM skill WHERE id = $1`, [skillId]);
    await audit(session, "reference.skill_merge", "skill", skillId, { into: existing.id, name });
    back("skills", "merged");
  }
  await query(`UPDATE skill SET name = $2 WHERE id = $1`, [skillId, name]);
  await audit(session, "reference.skill_rename", "skill", skillId, { name });
  back("skills", "saved");
}

export async function saveJobCategoryAction(fd: FormData): Promise<void> {
  const session = await requireAdmin("admin");
  const catId = Number(str(fd, "categoryId")) || null;
  const name = str(fd, "categoryName");
  const sort = Number(str(fd, "sortOrder")) || 100;
  if (fd.get("intent") === "delete" && catId) {
    await query(`DELETE FROM job_category WHERE id = $1`, [catId]);
    await audit(session, "reference.category_delete", "job_category", catId);
    back("categories", "deleted");
  }
  if (!name || name.length > 60) back("categories", "invalid");
  if (catId) {
    // employment stores the category by name, so a rename carries over to it.
    const [old] = await query<{ name: string }>(`SELECT name FROM job_category WHERE id = $1`, [catId]);
    await query(`UPDATE job_category SET name = $2, sort_order = $3 WHERE id = $1`, [catId, name, sort]);
    if (old && old.name !== name) await query(`UPDATE employment SET job_category = $2 WHERE job_category = $1`, [old.name, name]);
  }
  else await query(`INSERT INTO job_category (name, sort_order) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`, [name, sort]);
  await audit(session, catId ? "reference.category_update" : "reference.category_add", "job_category", catId ?? name, { name });
  back("categories", "saved");
}
