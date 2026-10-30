import "server-only";
import { query } from "./db";

/**
 * Job and internship board (FR-JOB-01 … 06).
 * A post is live while it is approved and its closing date has not passed
 * (FR-JOB-04) — expiry is a query condition, so nothing has to run on time.
 */

export const JOB_TYPES = ["งานประจำ", "ฝึกงาน", "สหกิจศึกษา"] as const;
export const LIVE_JOB_SQL = `j.moderation_status = 'approved' AND (j.closes_at IS NULL OR j.closes_at >= (now() AT TIME ZONE 'Asia/Bangkok')::date)`;

export interface JobFilter {
  q: string;
  type: string;
  program: string; // current programme id
  province: string;
  skill: string;
  page: number;
}

export const JOB_PAGE_SIZE = 12;

export function parseJobFilter(sp: Record<string, string | string[] | undefined>): JobFilter {
  const one = (k: string) => ((Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? "").trim();
  return {
    q: one("q").slice(0, 100),
    type: (JOB_TYPES as readonly string[]).includes(one("type")) ? one("type") : "",
    program: /^\d+$/.test(one("program")) ? one("program") : "",
    province: one("province").slice(0, 60),
    skill: one("skill").slice(0, 60),
    page: Math.max(1, Number(one("page")) || 1),
  };
}

export interface JobCardData {
  id: number;
  title: string;
  organization: string;
  type: string;
  location: string | null;
  province: string | null;
  closesAt: Date | null;
  description: string | null;
  applyUrl: string | null;
  contactEmail: string | null;
  postedByAlumni: boolean;
  posterName: string | null;
  skills: string[];
  programs: string[];
}

const SELECT = `
  SELECT j.id, j.title, j.organization, j.employment_type::text AS type, j.location, j.province, j.closes_at,
         j.description, j.apply_url, j.contact_email, j.posted_by IS NOT NULL AS posted_by_alumni,
         a.first_name_th || ' ' || a.last_name_th AS poster_name,
         coalesce((SELECT array_agg(s.name ORDER BY s.name) FROM job_post_skill x JOIN skill s ON s.id = x.skill_id WHERE x.job_post_id = j.id), '{}') AS skills,
         coalesce((SELECT array_agg(DISTINCT pr.current_name_th) FROM job_post_program x JOIN program_resolved pr ON pr.id = x.program_id WHERE x.job_post_id = j.id), '{}') AS programs
  FROM job_post j LEFT JOIN alumni a ON a.id = j.posted_by`;

interface Row {
  id: number; title: string; organization: string; type: string; location: string | null; province: string | null;
  closes_at: Date | null; description: string | null; apply_url: string | null; contact_email: string | null;
  posted_by_alumni: boolean; poster_name: string | null; skills: string[]; programs: string[];
}

function toCard(r: Row): JobCardData {
  return {
    id: r.id, title: r.title, organization: r.organization, type: r.type, location: r.location, province: r.province,
    closesAt: r.closes_at, description: r.description, applyUrl: r.apply_url, contactEmail: r.contact_email,
    postedByAlumni: r.posted_by_alumni, posterName: r.poster_name, skills: r.skills, programs: r.programs,
  };
}

export async function listJobs(f: JobFilter): Promise<{ jobs: JobCardData[]; total: number }> {
  const params: unknown[] = [];
  const where = [LIVE_JOB_SQL];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.q) {
    const like = p(`%${f.q}%`);
    where.push(`(j.title ILIKE ${like} OR j.organization ILIKE ${like} OR j.description ILIKE ${like})`);
  }
  if (f.type) where.push(`j.employment_type::text = ${p(f.type)}`);
  if (f.province) where.push(`j.province = ${p(f.province)}`);
  if (f.program) {
    // A post with no programme listed is open to every programme.
    const prog = p(Number(f.program));
    where.push(`(NOT EXISTS (SELECT 1 FROM job_post_program x WHERE x.job_post_id = j.id)
               OR EXISTS (SELECT 1 FROM job_post_program x JOIN program_resolved pr ON pr.id = x.program_id
                          WHERE x.job_post_id = j.id AND pr.current_id = ${prog}))`);
  }
  if (f.skill) {
    where.push(`EXISTS (SELECT 1 FROM job_post_skill x JOIN skill s ON s.id = x.skill_id WHERE x.job_post_id = j.id AND s.name = ${p(f.skill)})`);
  }
  const w = where.join(" AND ");
  const [{ n }] = await query<{ n: string }>(`SELECT count(*) AS n FROM job_post j WHERE ${w}`, params);
  const lim = p(JOB_PAGE_SIZE);
  const off = p((f.page - 1) * JOB_PAGE_SIZE);
  const rows = await query<Row>(`${SELECT} WHERE ${w} ORDER BY coalesce(j.approved_at, j.created_at) DESC LIMIT ${lim} OFFSET ${off}`, params);
  return { jobs: rows.map(toCard), total: Number(n) };
}

export async function getLiveJob(id: number): Promise<JobCardData | null> {
  const [r] = await query<Row>(`${SELECT} WHERE j.id = $1 AND ${LIVE_JOB_SQL}`, [id]);
  return r ? toCard(r) : null;
}

export async function jobFilterOptions(): Promise<{ provinces: string[]; skills: string[]; programs: { id: number; name: string }[] }> {
  const [provinces, skills, programs] = await Promise.all([
    query<{ v: string }>(`SELECT DISTINCT j.province AS v FROM job_post j WHERE ${LIVE_JOB_SQL} AND j.province IS NOT NULL ORDER BY 1`),
    query<{ v: string }>(
      `SELECT DISTINCT s.name AS v FROM job_post j JOIN job_post_skill x ON x.job_post_id = j.id JOIN skill s ON s.id = x.skill_id
       WHERE ${LIVE_JOB_SQL} ORDER BY 1`,
    ),
    query<{ id: number; name: string }>(
      `SELECT DISTINCT current_id AS id, degree_level::text || ' ' || current_name_th AS name FROM program_resolved
       WHERE id = current_id ORDER BY name`,
    ),
  ]);
  return { provinces: provinces.map((r) => r.v), skills: skills.map((r) => r.v), programs };
}

// FR-JOB-06 matching runs in the cron task (cron.ts → jobMatches), within a
// minute of approval, so a slow fan-out never delays the moderator's page.
