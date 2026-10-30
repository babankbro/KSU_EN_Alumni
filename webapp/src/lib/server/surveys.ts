import "server-only";
import { query } from "./db";
import { MIN_CELL, SENSITIVE_IDS, type Answers, type Question } from "../surveys";

/** Survey storage and the profile prefill (FR-SVY-01 … 08). */

export interface SurveyData {
  id: number;
  title: string;
  description: string | null;
  audience: "alumni" | "employer";
  status: "draft" | "open" | "closed";
  opensAt: Date | null;
  closesAt: Date | null;
  questions: Question[];
}

interface Row {
  id: number; title: string; description: string | null; audience: "alumni" | "employer"; status: "draft" | "open" | "closed";
  opens_at: Date | null; closes_at: Date | null; questions: Question[];
}
const toSurvey = (r: Row): SurveyData => ({
  id: r.id, title: r.title, description: r.description, audience: r.audience, status: r.status,
  opensAt: r.opens_at, closesAt: r.closes_at, questions: r.questions,
});
export const OPEN_SQL = `s.status = 'open' AND (s.opens_at IS NULL OR s.opens_at <= now()) AND (s.closes_at IS NULL OR s.closes_at > now())`;

export async function listOpenSurveys(audience: "alumni" | "employer"): Promise<SurveyData[]> {
  const rows = await query<Row>(`SELECT * FROM survey s WHERE s.audience = $1 AND ${OPEN_SQL} ORDER BY s.closes_at NULLS LAST`, [audience]);
  return rows.map(toSurvey);
}

export async function getSurvey(id: number, opts: { openOnly?: boolean } = {}): Promise<SurveyData | null> {
  const [r] = await query<Row>(`SELECT * FROM survey s WHERE s.id = $1 ${opts.openOnly ? `AND ${OPEN_SQL}` : ""}`, [id]);
  return r ? toSurvey(r) : null;
}

/** FR-SVY-03 — starting answers taken from the respondent's profile. */
export async function prefillFor(alumniId: string, questions: Question[]): Promise<Answers> {
  const [e] = await query<{ organization: string; position: string; sector: string | null }>(
    `SELECT organization, position, sector::text AS sector FROM employment WHERE alumni_id = $1 AND is_current
     ORDER BY start_month DESC NULLS LAST LIMIT 1`,
    [alumniId],
  );
  const source: Record<string, string | null | undefined> = {
    "employment.organization": e?.organization,
    "employment.position": e?.position,
    "employment.sector": e?.sector,
  };
  const out: Answers = {};
  for (const q of questions) {
    const v = q.prefill ? source[q.prefill] : undefined;
    if (v && (q.type !== "single" || (q.options ?? []).includes(v))) out[q.id] = v;
  }
  // Someone with a current job most likely answers "employed".
  const status = questions.find((q) => q.id === "status");
  if (e && status?.options?.includes("ทำงานแล้ว")) out.status = "ทำงานแล้ว";
  return out;
}

/** Denormalised at submit time so reports survive later profile edits (FR-SVY-07). */
export async function respondentFacts(alumniId: string): Promise<{ programId: number | null; graduationYear: number | null; yearsSinceGrad: number | null }> {
  const [a] = await query<{ program_id: number; graduation_year: number | null }>(
    `SELECT program_id, graduation_year FROM alumni WHERE id = $1`,
    [alumniId],
  );
  if (!a) return { programId: null, graduationYear: null, yearsSinceGrad: null };
  const beYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date())) + 543;
  return {
    programId: a.program_id,
    graduationYear: a.graduation_year,
    yearsSinceGrad: a.graduation_year ? Math.max(0, beYear - a.graduation_year) : null,
  };
}

/* ---------------- reporting (FR-SVY-05/06/07/08) ---------------- */

export interface ReportFilter {
  program: string; // current programme id
  gradYear: string;
}

export interface QuestionReport {
  question: Question;
  answered: number;
  /** single / scale: count per option; null when suppressed */
  counts: { option: string; n: number }[] | null;
  mean: number | null;
  textCount: number;
  suppressed: boolean;
}

export interface SurveyReport {
  total: number;
  questions: QuestionReport[];
  byProgram: { program: string; n: number; employed: number | null }[];
  byYears: { years: number; n: number; employed: number | null }[];
  texts: { question: string; answers: string[] }[];
}

const EMPLOYED = new Set(["ทำงานแล้ว", "ประกอบกิจการส่วนตัว"]);

/**
 * Aggregates only. Any group smaller than MIN_CELL is reported as suppressed,
 * and sensitive questions (salary) are never broken down further than the
 * filtered total — nobody can be singled out from a small cohort (FR-SVY-08).
 */
export async function surveyReport(survey: SurveyData, f: ReportFilter): Promise<SurveyReport> {
  const params: unknown[] = [survey.id];
  const where = ["r.survey_id = $1"];
  if (f.program) {
    params.push(Number(f.program));
    where.push(`pr.current_id = $${params.length}`);
  }
  if (f.gradYear) {
    params.push(Number(f.gradYear));
    where.push(`r.graduation_year = $${params.length}`);
  }
  const rows = await query<{ answers: Answers; program: string | null; years: number | null }>(
    `SELECT r.answers, pr.current_name_th AS program, r.years_since_grad AS years
     FROM survey_response r LEFT JOIN program_resolved pr ON pr.id = r.program_id
     WHERE ${where.join(" AND ")}`,
    params,
  );
  const total = rows.length;

  const questions: QuestionReport[] = survey.questions.map((q) => {
    const vals = rows.map((r) => r.answers[q.id]).filter((v): v is string => typeof v === "string" && v !== "");
    const suppressed = vals.length > 0 && vals.length < MIN_CELL && (SENSITIVE_IDS.has(q.id) || q.type !== "textarea");
    if (q.type === "single" || q.type === "scale") {
      const opts = q.type === "single" ? q.options ?? [] : Array.from({ length: (q.max ?? 5) - (q.min ?? 1) + 1 }, (_, i) => String((q.min ?? 1) + i));
      const counts = opts.map((o) => ({ option: o, n: vals.filter((v) => v === o).length }));
      const mean = q.type === "scale" && vals.length ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : null;
      return { question: q, answered: vals.length, counts: suppressed ? null : counts, mean: suppressed ? null : mean, textCount: 0, suppressed };
    }
    return { question: q, answered: vals.length, counts: null, mean: null, textCount: vals.length, suppressed: false };
  });

  const employedOf = (rs: typeof rows) => (rs.length < MIN_CELL ? null : rs.filter((r) => EMPLOYED.has(r.answers.status ?? "")).length);
  const group = <K extends string | number>(key: (r: (typeof rows)[number]) => K | null) => {
    const m = new Map<K, typeof rows>();
    for (const r of rows) {
      const k = key(r);
      if (k === null) continue;
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  };
  const hasStatus = survey.questions.some((q) => q.id === "status");
  const byProgram = hasStatus
    ? [...group((r) => r.program).entries()].map(([program, rs]) => ({ program, n: rs.length, employed: employedOf(rs) })).sort((a, b) => b.n - a.n)
    : [];
  const byYears = hasStatus
    ? [...group((r) => r.years).entries()].map(([years, rs]) => ({ years, n: rs.length, employed: employedOf(rs) })).sort((a, b) => a.years - b.years)
    : [];

  // Free-text comments, without any respondent details, for curriculum review.
  const texts = survey.questions
    .filter((q) => q.type === "textarea")
    .map((q) => ({ question: q.label, answers: rows.map((r) => r.answers[q.id]).filter((v): v is string => Boolean(v)).slice(0, 200) }))
    .filter((t) => t.answers.length);

  return { total, questions, byProgram, byYears, texts };
}
