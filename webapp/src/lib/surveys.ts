/**
 * Survey question model, shared by the wizard (client) and the server.
 * Stored as JSON in survey.questions (FR-SVY-01).
 */

export type QuestionType = "single" | "text" | "textarea" | "scale";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  /** FR-SVY-03: profile field used as the starting value, e.g. "employment.organization" */
  prefill?: string;
  /** Show only when another answer is one of these values. */
  showIf?: Record<string, string[]>;
}

export type Answers = Record<string, string>;

export function isShown(q: Question, answers: Answers): boolean {
  if (!q.showIf) return true;
  return Object.entries(q.showIf).every(([dep, values]) => values.includes(answers[dep] ?? ""));
}

/** Validates answers against the questions; hidden questions are dropped. */
export function validateAnswers(questions: Question[], raw: Answers): { answers: Answers; errors: Record<string, string> } {
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  for (const q of questions) {
    if (!isShown(q, { ...raw, ...answers })) continue;
    const v = (raw[q.id] ?? "").toString().trim();
    if (!v) {
      if (q.required) errors[q.id] = "กรุณาตอบข้อนี้";
      continue;
    }
    if (q.type === "single" && !(q.options ?? []).includes(v)) errors[q.id] = "กรุณาเลือกจากตัวเลือก";
    else if (q.type === "scale") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < (q.min ?? 1) || n > (q.max ?? 5)) errors[q.id] = "คะแนนไม่ถูกต้อง";
    } else if (v.length > (q.type === "textarea" ? 3000 : 300)) errors[q.id] = "ยาวเกินไป";
    if (!errors[q.id]) answers[q.id] = v;
  }
  return { answers, errors };
}

/** Accepts a questions JSON array from the admin form; returns a reason when invalid. */
export function parseQuestions(json: string): { questions: Question[] } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { error: "รูปแบบ JSON ไม่ถูกต้อง" };
  }
  if (!Array.isArray(data) || data.length === 0 || data.length > 60) return { error: "ต้องมีคำถาม 1–60 ข้อ" };
  const ids = new Set<string>();
  for (const q of data as Question[]) {
    if (!q || typeof q.id !== "string" || !/^[a-z][a-z0-9_]{0,40}$/.test(q.id)) return { error: "id ของคำถามต้องเป็นอักษรอังกฤษตัวเล็ก ตัวเลข หรือ _" };
    if (ids.has(q.id)) return { error: `id ซ้ำ: ${q.id}` };
    ids.add(q.id);
    if (!["single", "text", "textarea", "scale"].includes(q.type)) return { error: `ชนิดคำถามไม่รองรับ: ${q.id}` };
    if (typeof q.label !== "string" || !q.label.trim()) return { error: `คำถาม ${q.id} ไม่มีข้อความ` };
    if (q.type === "single" && (!Array.isArray(q.options) || q.options.length < 2)) return { error: `คำถาม ${q.id} ต้องมีตัวเลือกอย่างน้อย 2 ตัว` };
  }
  return { questions: data as Question[] };
}

/** Questions whose answers must only ever be shown in aggregate (FR-SVY-08). */
export const SENSITIVE_IDS = new Set(["salary"]);
/** Smallest group shown in any breakdown, so nobody can be singled out. */
export const MIN_CELL = 5;
