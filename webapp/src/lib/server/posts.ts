import "server-only";
import { query } from "./db";
import { fileUrl } from "./files";
import { isMember, viewerAccount, type Viewer } from "./member-auth";
import { enqueue } from "./notify";

/**
 * Alumni-authored news (FR-ANEWS-01 … 21).
 *
 * Visibility is decided in SQL by postVisibleSql() so the feed, the detail
 * page, profile pages and file serving all apply the same rule:
 *   public  → everyone
 *   members → verified alumni and staff
 *   cohort  → staff, and verified alumni with the author's admission year
 * The author always sees their own posts on /me/posts, never through here.
 */

export const POST_TYPES = [
  "ความก้าวหน้าในอาชีพ",
  "รางวัล/ความสำเร็จ",
  "ธุรกิจ/ผลงานใหม่",
  "กิจกรรมรุ่น",
  "ประชาสัมพันธ์ทั่วไป",
  "ข่าวไว้อาลัย",
] as const;
export type PostType = (typeof POST_TYPES)[number];
export const MEMORIAL: PostType = "ข่าวไว้อาลัย";

export type PostVisibility = "public" | "members" | "cohort";
export const POST_VISIBILITY_LABEL: Record<PostVisibility, string> = {
  public: "สาธารณะ",
  members: "เฉพาะสมาชิก",
  cohort: "เฉพาะรุ่นเดียวกัน",
};

export type ModStatus = "pending" | "approved" | "changes_requested" | "rejected" | "hidden";
export const MOD_STATUS_LABEL: Record<ModStatus, string> = {
  pending: "รอตรวจสอบ",
  approved: "เผยแพร่แล้ว",
  changes_requested: "ขอให้แก้ไข",
  rejected: "ไม่อนุมัติ",
  hidden: "ถูกซ่อน",
};

/**
 * SQL condition for "this viewer may read post p", where `au` is the author's
 * alumni row. Pushes its parameters onto `params`.
 */
export function postVisibleSql(viewer: Viewer, params: unknown[], p = "p", au = "au"): string {
  if (viewer.kind === "staff") return "true";
  if (!isMember(viewer)) return `${p}.visibility = 'public'`;
  const cohort = viewerAccount(viewer)?.admissionYear ?? null;
  params.push(cohort);
  return `(${p}.visibility IN ('public', 'members') OR (${p}.visibility = 'cohort' AND ${au}.admission_year = $${params.length}::int))`;
}

/** Published = approved, not a draft, has a publish time. */
export const PUBLISHED_SQL = `p.moderation_status = 'approved' AND NOT p.is_draft AND p.published_at IS NOT NULL`;

/** Who may react, comment and report: students and verified alumni. */
export function canInteract(viewer: Viewer): boolean {
  return viewer.kind === "student" || (viewer.kind === "alumni" && viewer.verified);
}

export interface FeedFilter {
  type: string;
  cohort: string;
  program: string; // current programme id
  page: number;
}

export function parseFeedFilter(sp: Record<string, string | string[] | undefined>): FeedFilter {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? "";
  const type = one("type");
  return {
    type: (POST_TYPES as readonly string[]).includes(type) ? type : "",
    cohort: /^\d{4}$/.test(one("cohort")) ? one("cohort") : "",
    program: /^\d+$/.test(one("program")) ? one("program") : "",
    page: Math.max(1, Number(one("page")) || 1),
  };
}

export const FEED_PAGE_SIZE = 10;

export interface PostCardData {
  id: number;
  type: PostType;
  title: string;
  body: string;
  visibility: PostVisibility;
  isPinned: boolean;
  publishedAt: Date;
  imageUrl: string | null;
  author: { id: string; name: string; admissionYear: number; program: string; listed: boolean };
  tagged: { id: string; name: string; listed: boolean }[];
  congrats: number;
  comments: number;
  reacted: boolean;
}

interface PostRow {
  id: number; type: PostType; title: string; body: string; visibility: PostVisibility; is_pinned: boolean;
  published_at: Date; image_file_id: string | null; author_id: string; author_name: string;
  admission_year: number; program: string; author_listed: boolean;
  tagged: { id: string; name: string; listed: boolean }[] | null;
  congrats: string; comments: string; reacted: boolean;
}

function selectPosts(where: string, tail: string): string {
  // `listed` = present in the public directory, so a profile link would work (FR-ANEWS-18).
  return `
    SELECT p.id, p.type::text AS type, p.title, p.body, p.visibility::text AS visibility, p.is_pinned,
           p.published_at, p.image_file_id, au.id AS author_id,
           au.title_th || au.first_name_th || ' ' || au.last_name_th AS author_name,
           au.admission_year, pr.current_name_th AS program,
           EXISTS (SELECT 1 FROM directory_public d WHERE d.id = au.id) AS author_listed,
           (SELECT json_agg(json_build_object('id', ta.id, 'name', ta.first_name_th || ' ' || ta.last_name_th,
                                              'listed', EXISTS (SELECT 1 FROM directory_public d WHERE d.id = ta.id))
                            ORDER BY ta.first_name_th)
              FROM alumni_post_tag t JOIN alumni ta ON ta.id = t.alumni_id
             WHERE t.post_id = p.id AND NOT t.declined AND ta.anonymized_at IS NULL) AS tagged,
           (SELECT count(*) FROM alumni_post_reaction r WHERE r.post_id = p.id) AS congrats,
           (SELECT count(*) FROM alumni_post_comment c WHERE c.post_id = p.id AND c.moderation_status = 'approved') AS comments,
           EXISTS (SELECT 1 FROM alumni_post_reaction r WHERE r.post_id = p.id AND r.account_id = $1::uuid) AS reacted
    FROM alumni_post p
    JOIN alumni au ON au.id = p.author_id
    JOIN program_resolved pr ON pr.id = au.program_id
    WHERE ${where}
    ${tail}`;
}

function toCard(r: PostRow): PostCardData {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    visibility: r.visibility,
    isPinned: r.is_pinned,
    publishedAt: r.published_at,
    imageUrl: r.image_file_id ? fileUrl(r.image_file_id) : null,
    author: { id: r.author_id, name: r.author_name, admissionYear: r.admission_year, program: r.program, listed: r.author_listed },
    tagged: r.tagged ?? [],
    congrats: Number(r.congrats),
    comments: Number(r.comments),
    reacted: r.reacted,
  };
}

/** FR-ANEWS-14/15/20 — newest first, pinned on top, filtered by type/cohort/programme. */
export async function listFeed(f: FeedFilter, viewer: Viewer, limit = FEED_PAGE_SIZE): Promise<{ posts: PostCardData[]; total: number }> {
  const params: unknown[] = [viewerAccount(viewer)?.id ?? null];
  const where = [PUBLISHED_SQL, "au.anonymized_at IS NULL", postVisibleSql(viewer, params)];
  if (f.type) {
    params.push(f.type);
    where.push(`p.type::text = $${params.length}`);
  }
  if (f.cohort) {
    params.push(Number(f.cohort));
    where.push(`au.admission_year = $${params.length}`);
  }
  if (f.program) {
    params.push(Number(f.program));
    where.push(`pr.current_id = $${params.length}`);
  }
  const w = where.join(" AND ");
  const [{ n }] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM alumni_post p JOIN alumni au ON au.id = p.author_id
     JOIN program_resolved pr ON pr.id = au.program_id
     -- $1 (the viewer's account) is only used by the row query; give it a type here.
     WHERE ${w} AND ($1::uuid IS NULL OR $1::uuid IS NOT NULL)`,
    params,
  );
  params.push(limit, (f.page - 1) * limit);
  const rows = await query<PostRow>(
    selectPosts(w, `ORDER BY p.is_pinned DESC, p.published_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`),
    params,
  );
  return { posts: rows.map(toCard), total: Number(n) };
}

export async function getVisiblePost(id: number, viewer: Viewer): Promise<PostCardData | null> {
  const params: unknown[] = [viewerAccount(viewer)?.id ?? null, id];
  const where = `p.id = $2 AND ${PUBLISHED_SQL} AND au.anonymized_at IS NULL AND ${postVisibleSql(viewer, params)}`;
  const [r] = await query<PostRow>(selectPosts(where, ""), params);
  return r ? toCard(r) : null;
}

/** Published posts by or tagging one person, for their profile (FR-ANEWS-19). */
export async function postsAboutPerson(alumniId: string, viewer: Viewer, limit = 10): Promise<PostCardData[]> {
  const params: unknown[] = [viewerAccount(viewer)?.id ?? null, alumniId];
  const where = `${PUBLISHED_SQL} AND au.anonymized_at IS NULL AND ${postVisibleSql(viewer, params)}
    AND (p.author_id = $2 OR EXISTS (SELECT 1 FROM alumni_post_tag t WHERE t.post_id = p.id AND t.alumni_id = $2 AND NOT t.declined))`;
  params.push(limit);
  const rows = await query<PostRow>(selectPosts(where, `ORDER BY p.published_at DESC LIMIT $${params.length}`), params);
  return rows.map(toCard);
}

export interface CommentData {
  id: number;
  body: string;
  createdAt: Date;
  authorName: string;
  mine: boolean;
}

export async function listComments(postId: number, viewer: Viewer): Promise<CommentData[]> {
  const me = viewerAccount(viewer)?.id ?? null;
  const rows = await query<{ id: number; body: string; created_at: Date; display_name: string; account_id: string }>(
    `SELECT c.id, c.body, c.created_at, ac.display_name, c.account_id
     FROM alumni_post_comment c JOIN account ac ON ac.id = c.account_id
     WHERE c.post_id = $1 AND c.moderation_status = 'approved'
     ORDER BY c.created_at`,
    [postId],
  );
  return rows.map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at, authorName: r.display_name, mine: r.account_id === me }));
}

/**
 * Accounts to tell about a newly published post: tagged people (FR-ANEWS-03)
 * and the author's cohort (FR-ANEWS-21). Cohort mail respects visibility —
 * nobody is told about a post they could not open.
 */
export async function audienceForPublishedPost(postId: number): Promise<{ tagged: string[]; cohort: string[]; post: { title: string; author: string } | null }> {
  const [post] = await query<{ title: string; author: string; author_id: string; admission_year: number }>(
    `SELECT p.title, au.first_name_th || ' ' || au.last_name_th AS author, p.author_id, au.admission_year
     FROM alumni_post p JOIN alumni au ON au.id = p.author_id WHERE p.id = $1`,
    [postId],
  );
  if (!post) return { tagged: [], cohort: [], post: null };
  const tagged = await query<{ id: string }>(
    `SELECT ac.id FROM alumni_post_tag t JOIN account ac ON ac.alumni_id = t.alumni_id
     WHERE t.post_id = $1 AND NOT t.declined AND ac.is_active`,
    [postId],
  );
  const taggedIds = tagged.map((r) => r.id);
  const cohort = await query<{ id: string }>(
    `SELECT ac.id FROM account ac JOIN alumni a ON a.id = ac.alumni_id
     WHERE a.admission_year = $1 AND a.claim_status = 'verified' AND a.id <> $2 AND ac.is_active
       AND NOT (ac.id = ANY($3::uuid[]))`,
    [post.admission_year, post.author_id, taggedIds],
  );
  return { tagged: taggedIds, cohort: cohort.map((r) => r.id), post: { title: post.title, author: post.author } };
}

/** Sends tag and cohort notifications once per post, however often it is re-approved. */
export async function notifyPublished(postId: number): Promise<void> {
  const { tagged, cohort, post } = await audienceForPublishedPost(postId);
  if (!post) return;
  const link = `/alumni-news/${postId}`;
  await enqueue("tag", tagged, {
    title: `${post.author} แท็กคุณในข่าว`,
    body: `“${post.title}” — ถ้าไม่ต้องการให้แท็ก ปฏิเสธได้ที่หน้า “ข่าวของฉัน”`,
    link,
    dedupeKey: `post-tag:${postId}`,
  });
  await enqueue("cohort_news", cohort, {
    title: `ข่าวใหม่จากรุ่นเดียวกัน: ${post.title}`,
    body: `${post.author} โพสต์ข่าวใหม่`,
    link,
    dedupeKey: `cohort-post:${postId}`,
  });
}
