import { query } from "@/lib/server/db";
import { getObjectStream } from "@/lib/server/storage";
import { PUBLIC_PURPOSES, type StoredPurpose } from "@/lib/server/files";
import { getViewer } from "@/lib/server/member-auth";
import { canSee, fieldVisibility, type Visibility } from "@/lib/server/profile";
import { PUBLISHED_SQL, postVisibleSql } from "@/lib/server/posts";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/files/:id — streams a stored object from the private bucket.
 *
 * - news, site, gallery images, event covers → anyone
 * - alumni-post images                       → the author, staff, or whoever
 *                                               may read the published post
 * - profile photos                            → staff, the owner, or anyone the
 *                                               owner's photo visibility allows,
 *                                               and only while they are listed
 *                                               in the directory (FR-PROF-03)
 * - documents, attachments, award evidence    → staff; news attachments → anyone
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const [file] = await query<{
    object_key: string; content_type: string; size_bytes: string; purpose: StoredPurpose;
    owner_alumni_id: string | null; is_news_attachment: boolean;
  }>(
    `SELECT f.object_key, f.content_type, f.size_bytes, f.purpose::text AS purpose, f.owner_alumni_id,
            EXISTS (SELECT 1 FROM news_attachment na JOIN news n ON n.id = na.news_id
                    WHERE na.file_id = f.id AND n.published_at <= now()) AS is_news_attachment
     FROM file_object f WHERE f.id = $1`,
    [id],
  ).catch(() => []);
  if (!file) return new Response("Not found", { status: 404 });

  const viewer = await getViewer();
  let allowed = PUBLIC_PURPOSES.includes(file.purpose) || file.is_news_attachment;
  let publicCache = allowed;

  if (!allowed && viewer.kind === "staff") allowed = true;

  if (!allowed && file.purpose === "profile_photo" && file.owner_alumni_id) {
    if ((viewer.kind === "alumni" || viewer.kind === "student") && viewer.account.alumniId === file.owner_alumni_id) {
      allowed = true;
    } else {
      const [d] = await query<{ field_visibility: Record<string, string> | null; visibility: Visibility | null; is_photo: boolean }>(
        `SELECT field_visibility, visibility, photo_file_id = $2 AS is_photo FROM directory_public WHERE id = $1`,
        [file.owner_alumni_id, id],
      );
      if (d?.is_photo) {
        const vis = fieldVisibility(d.field_visibility, d.visibility ?? "members", "photo");
        allowed = canSee(vis, viewer);
        publicCache = allowed && vis === "public";
      }
    }
  }

  if (!allowed && file.purpose === "post_image") {
    const own = (viewer.kind === "alumni" || viewer.kind === "student") && viewer.account.alumniId === file.owner_alumni_id;
    if (own) allowed = true;
    else {
      const params: unknown[] = [id];
      const [vis] = await query<{ visibility: string }>(
        `SELECT p.visibility::text AS visibility FROM alumni_post p JOIN alumni au ON au.id = p.author_id
         WHERE p.image_file_id = $1 AND ${PUBLISHED_SQL} AND ${postVisibleSql(viewer, params)} LIMIT 1`,
        params,
      );
      allowed = Boolean(vis);
      publicCache = vis?.visibility === "public";
    }
  }

  // 404 rather than 403: do not confirm that a private file exists.
  if (!allowed) return new Response("Not found", { status: 404 });

  try {
    const stream = await getObjectStream(file.object_key);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": file.content_type,
        "Content-Length": file.size_bytes,
        // Object keys are immutable UUIDs: a replaced image gets a new id.
        "Cache-Control": publicCache ? "public, max-age=31536000, immutable" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(file.content_type === "application/pdf" ? { "Content-Disposition": "inline" } : {}),
      },
    });
  } catch (err) {
    console.error("[api/files]", err);
    return new Response("Unavailable", { status: 503 });
  }
}
