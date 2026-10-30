import "server-only";
import { query } from "./db";
import { fileUrl } from "./files";
import { canSee, fieldVisibility, type Visibility } from "./profile";
import type { Viewer } from "./member-auth";

/**
 * Alumni directory backed by the `directory_public` view (FR-DIR-01 … 10).
 * The view already excludes unclaimed, deceased, anonymised and
 * non-consenting records (FR-DIR-07); this module adds search, facets with
 * real counts, and per-field visibility for the current viewer.
 */

export interface DirFilter {
  q: string;
  cohort: string[];
  program: string[]; // current programme ids, so old names fold into new ones
  level: string[];
  province: string[];
  category: string[];
  skill: string[];
  page: number;
}

export const DIR_PAGE_SIZE = 20;

type FacetKey = Exclude<keyof DirFilter, "q" | "page">;

function arr(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean).slice(0, 30);
}

export function parseDirFilter(sp: Record<string, string | string[] | undefined>): DirFilter {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? "";
  return {
    q: one("q").trim().slice(0, 100),
    cohort: arr(sp.cohort).filter((c) => /^\d{4}$/.test(c)),
    program: arr(sp.program).filter((p) => /^\d+$/.test(p)),
    level: arr(sp.level),
    province: arr(sp.province),
    category: arr(sp.category),
    skill: arr(sp.skill),
    page: Math.max(1, Number(one("page")) || 1),
  };
}

/** Builds the WHERE clause, optionally leaving one facet out (for that facet's own counts). */
function whereFor(f: DirFilter, skip?: FacetKey): { sql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (f.q) {
    const like = p(`%${f.q}%`);
    const raw = p(f.q);
    // FR-DIR-10: substring OR trigram similarity, over current and former names.
    where.push(`(
      (d.first_name_th || ' ' || d.last_name_th) ILIKE ${like}
      OR d.nickname ILIKE ${like}
      OR similarity(d.first_name_th || ' ' || d.last_name_th, ${raw}) > 0.3
      OR EXISTS (SELECT 1 FROM alumni_former_name fn WHERE fn.alumni_id = d.id AND (
           (fn.first_name_th || ' ' || fn.last_name_th) ILIKE ${like}
           OR similarity(fn.first_name_th || ' ' || fn.last_name_th, ${raw}) > 0.3))
      OR d.current_organization ILIKE ${like}
    )`);
  }
  if (skip !== "cohort" && f.cohort.length) where.push(`d.admission_year = ANY(${p(f.cohort.map(Number))}::int[])`);
  if (skip !== "program" && f.program.length) where.push(`d.program_current_id = ANY(${p(f.program.map(Number))}::int[])`);
  if (skip !== "level" && f.level.length) where.push(`d.degree_level::text = ANY(${p(f.level)}::text[])`);
  // Province and workplace facets only consider people who made that field
  // visible to at least members, so filtering cannot reveal a hidden value.
  if (skip !== "province" && f.province.length) {
    where.push(`d.province = ANY(${p(f.province)}::text[]) AND coalesce(d.field_visibility->>'province', d.visibility::text) <> 'private'`);
  }
  if (skip !== "category" && f.category.length) {
    where.push(`d.current_job_category = ANY(${p(f.category)}::text[]) AND coalesce(d.field_visibility->>'workplace', d.visibility::text) <> 'private'`);
  }
  if (skip !== "skill" && f.skill.length) {
    where.push(`EXISTS (SELECT 1 FROM alumni_skill x JOIN skill s ON s.id = x.skill_id WHERE x.alumni_id = d.id AND s.name = ANY(${p(f.skill)}::text[]))`);
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface Facets {
  cohort: FacetOption[];
  program: FacetOption[];
  level: FacetOption[];
  province: FacetOption[];
  category: FacetOption[];
  skill: FacetOption[];
}

async function facet(f: DirFilter, key: FacetKey, select: string, groupBy: string, extra = "", limit = 30): Promise<FacetOption[]> {
  const w = whereFor(f, key);
  const rows = await query<{ value: string; label: string; count: string }>(
    `SELECT ${select}, count(DISTINCT d.id) AS count
     FROM directory_public d ${extra}
     ${w.sql ? `${w.sql} AND` : "WHERE"} ${groupBy} IS NOT NULL
     GROUP BY 1, 2 ORDER BY count DESC, 2 LIMIT ${limit}`,
    w.params,
  );
  return rows.map((r) => ({ value: String(r.value), label: r.label, count: Number(r.count) }));
}

/** FR-DIR-03 — counts per option, with every *other* active filter applied. */
export async function getFacets(f: DirFilter): Promise<Facets> {
  const [cohort, program, level, province, category, skill] = await Promise.all([
    facet(f, "cohort", "d.admission_year::text AS value, d.admission_year::text AS label", "d.admission_year", "", 60),
    facet(f, "program", "d.program_current_id::text AS value, d.degree_level || ' ' || d.program_current_name_th AS label", "d.program_current_id"),
    facet(f, "level", "d.degree_level::text AS value, d.degree_level::text AS label", "d.degree_level"),
    facet(
      f,
      "province",
      "d.province AS value, d.province AS label",
      "CASE WHEN coalesce(d.field_visibility->>'province', d.visibility::text) <> 'private' THEN d.province END",
    ),
    facet(
      f,
      "category",
      "d.current_job_category AS value, d.current_job_category AS label",
      "CASE WHEN coalesce(d.field_visibility->>'workplace', d.visibility::text) <> 'private' THEN d.current_job_category END",
    ),
    facet(f, "skill", "s.name AS value, s.name AS label", "s.name", "JOIN alumni_skill x ON x.alumni_id = d.id JOIN skill s ON s.id = x.skill_id", 25),
  ]);
  // Cohorts read best newest-first, not by size.
  cohort.sort((a, b) => Number(b.value) - Number(a.value));
  return { cohort, program, level, province, category, skill };
}

export interface DirectoryPerson {
  id: string;
  name: string;
  nickname: string | null;
  admissionYear: number;
  graduationYear: number | null;
  level: string;
  program: string;
  programCurrent: string;
  profileUpdatedAt: Date;
  stale: boolean;
  isNotable: boolean;
  photoUrl: string | null;
  // Only filled when the viewer may see them (FR-PROF-03 / FR-DIR-06)
  province: string | null;
  organization: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  lineId: string | null;
  skills: string[];
  hiddenContact: boolean;
}

interface Row {
  id: string; title_th: string; first_name_th: string; last_name_th: string; nickname: string | null;
  admission_year: number; graduation_year: number | null; degree_level: string;
  program_name_th: string; program_current_name_th: string; profile_updated_at: Date; stale: boolean;
  is_notable: boolean; photo_file_id: string | null; province: string | null; visibility: Visibility | null;
  field_visibility: Record<string, string> | null; email: string | null; phone: string | null; line_id: string | null;
  current_organization: string | null; current_position: string | null; skills: string[] | null;
}

export function toPerson(r: Row, viewer: Viewer): DirectoryPerson {
  const fallback = r.visibility ?? "members";
  const see = (f: Parameters<typeof fieldVisibility>[2]) => canSee(fieldVisibility(r.field_visibility, fallback, f), viewer);
  const contactFields = [see("email") && r.email, see("phone") && r.phone, see("line") && r.line_id];
  const hasAnyContact = Boolean(r.email || r.phone || r.line_id);
  return {
    id: r.id,
    name: `${r.title_th}${r.first_name_th} ${r.last_name_th}`,
    nickname: r.nickname,
    admissionYear: r.admission_year,
    graduationYear: r.graduation_year,
    level: r.degree_level,
    program: r.program_name_th,
    programCurrent: r.program_current_name_th,
    profileUpdatedAt: r.profile_updated_at,
    stale: r.stale,
    isNotable: r.is_notable,
    photoUrl: r.photo_file_id && see("photo") ? fileUrl(r.photo_file_id) : null,
    province: see("province") ? r.province : null,
    organization: see("workplace") ? r.current_organization : null,
    position: see("workplace") ? r.current_position : null,
    email: see("email") ? r.email : null,
    phone: see("phone") ? r.phone : null,
    lineId: see("line") ? r.line_id : null,
    skills: r.skills ?? [],
    hiddenContact: hasAnyContact && !contactFields.some(Boolean),
  };
}

const SELECT = `
  SELECT d.id, d.title_th, d.first_name_th, d.last_name_th, d.nickname, d.admission_year, d.graduation_year,
         d.degree_level::text AS degree_level, d.program_name_th, d.program_current_name_th, d.profile_updated_at,
         d.profile_updated_at < now() - interval '12 months' AS stale, d.is_notable, d.photo_file_id,
         d.province, d.visibility, d.field_visibility, d.email, d.phone, d.line_id,
         d.current_organization, d.current_position,
         (SELECT array_agg(s.name ORDER BY s.name) FROM alumni_skill x JOIN skill s ON s.id = x.skill_id WHERE x.alumni_id = d.id) AS skills
  FROM directory_public d`;

export async function searchDirectory(f: DirFilter, viewer: Viewer): Promise<{ people: DirectoryPerson[]; total: number }> {
  const w = whereFor(f);
  const order = f.q
    ? `ORDER BY greatest(similarity(d.first_name_th || ' ' || d.last_name_th, $${w.params.length + 1}),
                CASE WHEN (d.first_name_th || ' ' || d.last_name_th) ILIKE $${w.params.length + 2} THEN 1 ELSE 0 END) DESC,
                d.first_name_th`
    : `ORDER BY d.admission_year DESC, d.first_name_th`;
  const params = f.q ? [...w.params, f.q, `%${f.q}%`] : w.params;

  const [countRow] = await query<{ n: string }>(`SELECT count(*) AS n FROM directory_public d ${w.sql}`, w.params);
  const rows = await query<Row>(
    `${SELECT} ${w.sql} ${order} LIMIT ${DIR_PAGE_SIZE} OFFSET ${(f.page - 1) * DIR_PAGE_SIZE}`,
    params,
  );
  return { people: rows.map((r) => toPerson(r, viewer)), total: Number(countRow?.n ?? 0) };
}

export async function getDirectoryPerson(id: string, viewer: Viewer): Promise<(DirectoryPerson & { formerNames: string[] }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await query<Row>(`${SELECT} WHERE d.id = $1`, [id]);
  if (!r) return null;
  const person = toPerson(r, viewer);
  const isMemberViewer = viewer.kind === "staff" || (viewer.kind === "alumni" && viewer.verified);
  const formerNames = isMemberViewer
    ? (await query<{ n: string }>(`SELECT first_name_th || ' ' || last_name_th AS n FROM alumni_former_name WHERE alumni_id = $1`, [id])).map((x) => x.n)
    : [];
  return { ...person, formerNames };
}

/** FR-DIR-04 — cohort roll: counts per admission year and programme. */
export async function getCohortRoll(): Promise<{ year: number; total: number; programs: { name: string; level: string; n: number }[] }[]> {
  const rows = await query<{ year: number; name: string; level: string; n: string }>(
    `SELECT admission_year AS year, program_current_name_th AS name, degree_level::text AS level, count(*) AS n
     FROM directory_public GROUP BY 1, 2, 3 ORDER BY 1 DESC, 4 DESC`,
  );
  const out = new Map<number, { year: number; total: number; programs: { name: string; level: string; n: number }[] }>();
  for (const r of rows) {
    const e = out.get(r.year) ?? { year: r.year, total: 0, programs: [] };
    e.total += Number(r.n);
    e.programs.push({ name: r.name, level: r.level, n: Number(r.n) });
    out.set(r.year, e);
  }
  return [...out.values()];
}

/** FR-DIR-05 — headline figures for the home page, from real data. */
export async function getSiteFigures(): Promise<{ alumni: number; cohorts: number; programs: number; freshPct: number } | null> {
  try {
    const [r] = await query<{ alumni: string; cohorts: string; programs: string; fresh: string }>(
      `SELECT count(*) AS alumni,
              count(DISTINCT admission_year) AS cohorts,
              (SELECT count(*) FROM program WHERE status = 'active') AS programs,
              count(*) FILTER (WHERE profile_updated_at > now() - interval '12 months') AS fresh
       FROM alumni WHERE claim_status = 'verified' AND anonymized_at IS NULL`,
    );
    const alumni = Number(r.alumni);
    return {
      alumni,
      cohorts: Number(r.cohorts),
      programs: Number(r.programs),
      freshPct: alumni ? Math.round((Number(r.fresh) / alumni) * 100) : 0,
    };
  } catch {
    return null;
  }
}
