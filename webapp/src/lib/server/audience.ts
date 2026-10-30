import "server-only";
import { query } from "./db";

/** Target groups for broadcasts (FR-NOTI-05). */

export interface AudienceFilter {
  who: "alumni" | "students" | "all";
  cohortFrom: number | null;
  cohortTo: number | null;
  program: number | null; // current programme id
  level: string;
}

export function parseAudience(get: (k: string) => string): AudienceFilter {
  const num = (k: string) => (/^\d{4}$/.test(get(k)) ? Number(get(k)) : null);
  const who = get("who");
  return {
    who: who === "students" || who === "all" ? who : "alumni",
    cohortFrom: num("cohortFrom"),
    cohortTo: num("cohortTo"),
    program: /^\d+$/.test(get("program")) ? Number(get("program")) : null,
    level: get("level").slice(0, 10),
  };
}

/**
 * Active accounts in the group. Alumni must be verified. Students carry no
 * programme or cohort, so those filters narrow the group to alumni only.
 */
export async function audienceAccounts(f: AudienceFilter): Promise<string[]> {
  const params: unknown[] = [];
  const alumniWhere = ["a.claim_status = 'verified'", "a.anonymized_at IS NULL"];
  if (f.cohortFrom) {
    params.push(f.cohortFrom);
    alumniWhere.push(`a.admission_year >= $${params.length}`);
  }
  if (f.cohortTo) {
    params.push(f.cohortTo);
    alumniWhere.push(`a.admission_year <= $${params.length}`);
  }
  if (f.program) {
    params.push(f.program);
    alumniWhere.push(`pr.current_id = $${params.length}`);
  }
  if (f.level) {
    params.push(f.level);
    alumniWhere.push(`pr.degree_level::text = $${params.length}`);
  }
  const narrowed = Boolean(f.cohortFrom || f.cohortTo || f.program || f.level);
  const parts: string[] = [];
  if (f.who !== "students") {
    parts.push(`SELECT ac.id FROM account ac JOIN alumni a ON a.id = ac.alumni_id JOIN program_resolved pr ON pr.id = a.program_id
                WHERE ac.is_active AND ac.role = 'alumni' AND ${alumniWhere.join(" AND ")}`);
  }
  if (f.who !== "alumni" && !narrowed) parts.push(`SELECT id FROM account WHERE is_active AND role = 'student'`);
  if (!parts.length) return [];
  return (await query<{ id: string }>(parts.join(" UNION "), params)).map((r) => r.id);
}
