import "server-only";
import { query } from "./db";
import { fileUrl } from "./files";
import type { NewsItem } from "../types";

/**
 * Read side of the editable site content (FR-ADM-14 … FR-ADM-17).
 *
 * Every getter falls back to built-in defaults when the database is down, so a
 * database outage degrades the site to its shipped wording instead of a 500.
 */

export const DEFAULT_SETTINGS: Record<string, string> = {
  "hero.eyebrow": "Faculty of Engineering and Industrial Technology · Kalasin University",
  "hero.title": "เครือข่ายศิษย์เก่า",
  "hero.titleEm": "คณะวิศวกรรมศาสตร์ฯ ม.กาฬสินธุ์",
  "hero.lead":
    "รวมพลังศิษย์เก่าทุกรุ่นทุกสาขา ตั้งแต่ ปวส. ถึงปริญญาตรี เพื่อเชื่อมโยงรุ่นพี่รุ่นน้อง แบ่งปันโอกาสทางอาชีพ และร่วมพัฒนาหลักสูตรของคณะอย่างต่อเนื่อง",
  "dean.quote":
    "ศิษย์เก่าคือภาพสะท้อนที่ตรงที่สุดว่าคณะของเราผลิตบัณฑิตได้ตรงกับความต้องการของสังคมเพียงใด ระบบศิษย์เก่านี้จึงไม่ได้ทำขึ้นเพื่อเก็บรายชื่อ แต่ทำขึ้นเพื่อให้เสียงของศิษย์เก่ากลับมาถึงห้องเรียน และเพื่อให้รุ่นพี่ส่งต่อโอกาสให้รุ่นน้องได้จริง",
  "dean.name": "คณบดีคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม",
  "dean.org": "มหาวิทยาลัยกาฬสินธุ์",
  "contact.unit": "งานศิษย์เก่าสัมพันธ์ คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม",
  "contact.address": "มหาวิทยาลัยกาฬสินธุ์ อำเภอเมือง จังหวัดกาฬสินธุ์ 46000",
  "contact.phone": "043-602-053",
  "contact.email": "alumni.eng@ksu.ac.th",
  "contact.line": "@ksu-eng-alumni",
  "social.facebook": "",
  "social.line": "",
  "social.youtube": "",
  "footer.about":
    "เครือข่ายศิษย์เก่าคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม เพื่อเชื่อมโยงรุ่นพี่รุ่นน้อง ส่งต่อโอกาสทางอาชีพ และร่วมพัฒนาหลักสูตรของคณะ",
};

export type Settings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<Settings> {
  try {
    const rows = await query<{ key: string; value: string }>(`SELECT key, value FROM site_setting`);
    const merged = { ...DEFAULT_SETTINGS };
    for (const r of rows) merged[r.key] = r.value;
    return merged;
  } catch (err) {
    console.error("[content] settings unavailable, using defaults", err);
    return { ...DEFAULT_SETTINGS };
  }
}

export interface SiteImage {
  /** null = no picture for this slot (render the placeholder). */
  src: string | null;
  alt: string;
  isCustom: boolean;
}

const DEFAULT_IMAGES: Record<string, SiteImage> = {
  hero: {
    src: "/images/hero-alumni.png",
    alt: "ศิษย์เก่าและนักศึกษาวิศวกรรมศาสตร์แลกเปลี่ยนประสบการณ์ในมหาวิทยาลัย",
    isCustom: false,
  },
  dean: { src: null, alt: "ภาพคณบดี", isCustom: false },
  "news.default": { src: null, alt: "ภาพปกข่าว", isCustom: false },
};

export async function getSiteImages(): Promise<Record<string, SiteImage>> {
  try {
    const rows = await query<{ slot: string; fallback_path: string; alt_text: string; file_id: string | null }>(
      `SELECT slot, fallback_path, alt_text, file_id FROM site_image`,
    );
    const out = { ...DEFAULT_IMAGES };
    for (const r of rows) {
      out[r.slot] = {
        src: r.file_id ? fileUrl(r.file_id) : r.fallback_path || null,
        alt: r.alt_text,
        isCustom: Boolean(r.file_id),
      };
    }
    return out;
  } catch (err) {
    console.error("[content] images unavailable, using defaults", err);
    return { ...DEFAULT_IMAGES };
  }
}

/* ---------- news ---------- */

/** timestamptz → Buddhist-era "2569-09-18" in Bangkok time, the format the UI uses. */
export function toBeDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${Number(get("year")) + 543}-${get("month")}-${get("day")}`;
}

interface NewsRow {
  id: number;
  title: string;
  summary: string | null;
  body: string | null;
  category: string | null;
  published_at: Date;
  cover_file_id: string | null;
  is_pinned: boolean;
  tags?: string[] | null;
  attachments?: { file_id: string; label: string }[] | null;
}

export interface NewsDetail extends NewsItem {
  body: string;
  coverSrc: string | null;
  isPinned: boolean;
  tags: string[];
  attachments: { url: string; label: string }[];
}

function toNews(r: NewsRow, defaultCover: string | null): NewsDetail {
  return {
    id: String(r.id),
    title: r.title,
    summary: r.summary ?? "",
    body: r.body ?? "",
    category: r.category ?? "ข่าวคณะ",
    publishedAt: toBeDate(r.published_at),
    href: `/news/${r.id}`,
    coverSrc: r.cover_file_id ? fileUrl(r.cover_file_id) : defaultCover,
    isPinned: r.is_pinned,
    tags: r.tags ?? [],
    attachments: (r.attachments ?? []).map((a) => ({ url: fileUrl(a.file_id), label: a.label })),
  };
}

const NEWS_EXTRAS = `
  (SELECT array_agg(t.tag ORDER BY t.tag) FROM news_tag t WHERE t.news_id = news.id) AS tags,
  (SELECT json_agg(json_build_object('file_id', a.file_id, 'label', a.label) ORDER BY a.label)
     FROM news_attachment a WHERE a.news_id = news.id) AS attachments`;

/** FR-NEWS-03 — published news by text (substring or trigram), category and tag. */
export async function searchPublishedNews(f: { q: string; category: string; tag: string }, limit = 60): Promise<NewsDetail[]> {
  const params: unknown[] = [];
  const where = ["published_at IS NOT NULL", "published_at <= now()"];
  if (f.q) {
    params.push(`%${f.q}%`, f.q);
    where.push(`((title || ' ' || coalesce(summary, '') || ' ' || coalesce(body, '')) ILIKE $${params.length - 1}
                 OR similarity(title || ' ' || coalesce(summary, ''), $${params.length}) > 0.25)`);
  }
  if (f.category) {
    params.push(f.category);
    where.push(`category = $${params.length}`);
  }
  if (f.tag) {
    params.push(f.tag);
    where.push(`EXISTS (SELECT 1 FROM news_tag t WHERE t.news_id = news.id AND t.tag = $${params.length})`);
  }
  params.push(limit);
  const [rows, images] = await Promise.all([
    query<NewsRow>(
      `SELECT id, title, summary, body, category, published_at, cover_file_id, is_pinned, ${NEWS_EXTRAS}
       FROM news WHERE ${where.join(" AND ")} ORDER BY is_pinned DESC, published_at DESC LIMIT $${params.length}`,
      params,
    ),
    getSiteImages(),
  ]);
  return rows.map((r) => toNews(r, images["news.default"]?.src ?? null));
}

export async function newsFacets(): Promise<{ categories: string[]; tags: { tag: string; n: number }[] }> {
  const [cats, tags] = await Promise.all([
    query<{ category: string }>(`SELECT DISTINCT category FROM news WHERE published_at <= now() AND category IS NOT NULL ORDER BY 1`),
    query<{ tag: string; n: string }>(
      `SELECT t.tag, count(*) AS n FROM news_tag t JOIN news n ON n.id = t.news_id WHERE n.published_at <= now()
       GROUP BY t.tag ORDER BY count(*) DESC, t.tag LIMIT 20`,
    ),
  ]);
  return { categories: cats.map((c) => c.category), tags: tags.map((t) => ({ tag: t.tag, n: Number(t.n) })) };
}

/** Published news only; drafts (published_at NULL) and future-dated items stay hidden. */
export async function listPublishedNews(limit = 50): Promise<NewsDetail[] | null> {
  try {
    const [rows, images] = await Promise.all([
      query<NewsRow>(
        `SELECT id, title, summary, body, category, published_at, cover_file_id, is_pinned
         FROM news
         WHERE published_at IS NOT NULL AND published_at <= now()
         ORDER BY is_pinned DESC, published_at DESC
         LIMIT $1`,
        [limit],
      ),
      getSiteImages(),
    ]);
    return rows.map((r) => toNews(r, images["news.default"]?.src ?? null));
  } catch (err) {
    console.error("[content] news unavailable", err);
    return null; // caller decides on a fallback
  }
}

export async function getPublishedNews(id: number): Promise<NewsDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const [rows, images] = await Promise.all([
      query<NewsRow>(
        `SELECT id, title, summary, body, category, published_at, cover_file_id, is_pinned, ${NEWS_EXTRAS}
         FROM news WHERE id = $1 AND published_at IS NOT NULL AND published_at <= now()`,
        [id],
      ),
      getSiteImages(),
    ]);
    return rows[0] ? toNews(rows[0], images["news.default"]?.src ?? null) : null;
  } catch (err) {
    console.error("[content] news item unavailable", err);
    return null;
  }
}
