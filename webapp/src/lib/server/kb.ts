import "server-only";
import { query } from "./db";

/** Knowledge base — experience articles by alumni (FR-KB-01 … 03). */

export const KB_CATEGORIES = [
  "อาชีพและการทำงาน",
  "การเรียนต่อ",
  "ใบประกอบวิชาชีพ (กว.)",
  "การเริ่มธุรกิจ",
  "เทคนิคและเครื่องมือ",
  "ชีวิตหลังเรียนจบ",
] as const;

export interface ArticleData {
  id: number;
  title: string;
  summary: string | null;
  body: string;
  category: string;
  publishedAt: Date;
  author: { id: string; name: string; admissionYear: number; program: string; listed: boolean };
}

interface Row {
  id: number; title: string; summary: string | null; body: string; category: string; published_at: Date;
  author_id: string; author: string; admission_year: number; program: string; listed: boolean;
}

const SELECT = `
  SELECT k.id, k.title, k.summary, k.body, k.category, k.published_at, a.id AS author_id,
         a.first_name_th || ' ' || a.last_name_th AS author, a.admission_year, pr.current_name_th AS program,
         EXISTS (SELECT 1 FROM directory_public d WHERE d.id = a.id) AS listed
  FROM kb_article k JOIN alumni a ON a.id = k.author_id JOIN program_resolved pr ON pr.id = a.program_id`;
const PUBLISHED = `k.moderation_status = 'approved' AND k.published_at IS NOT NULL AND a.anonymized_at IS NULL`;

function toArticle(r: Row): ArticleData {
  return {
    id: r.id, title: r.title, summary: r.summary, body: r.body, category: r.category, publishedAt: r.published_at,
    author: { id: r.author_id, name: r.author, admissionYear: r.admission_year, program: r.program, listed: r.listed },
  };
}

/** FR-KB-03 — by category and/or text (substring or trigram similarity). */
export async function searchArticles(q: string, category: string): Promise<ArticleData[]> {
  const params: unknown[] = [];
  const where = [PUBLISHED];
  if (category) {
    params.push(category);
    where.push(`k.category = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`, q);
    where.push(`((k.title || ' ' || coalesce(k.summary, '') || ' ' || k.body) ILIKE $${params.length - 1}
                 OR similarity(k.title, $${params.length}) > 0.3)`);
  }
  const rows = await query<Row>(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY k.published_at DESC LIMIT 60`, params);
  return rows.map(toArticle);
}

export async function getPublishedArticle(id: number): Promise<ArticleData | null> {
  const [r] = await query<Row>(`${SELECT} WHERE k.id = $1 AND ${PUBLISHED}`, [id]);
  return r ? toArticle(r) : null;
}

export async function categoryCounts(): Promise<Map<string, number>> {
  const rows = await query<{ category: string; n: string }>(
    `SELECT k.category, count(*) AS n FROM kb_article k JOIN alumni a ON a.id = k.author_id WHERE ${PUBLISHED} GROUP BY k.category`,
  );
  return new Map(rows.map((r) => [r.category, Number(r.n)]));
}
