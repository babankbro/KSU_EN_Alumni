import { query } from "@/lib/server/db";
import { getObjectStream } from "@/lib/server/storage";
import { PUBLIC_PURPOSES, type StoredPurpose } from "@/lib/server/files";
import { getAdminSession } from "@/lib/server/auth";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/files/:id — streams a stored object from the private bucket.
 *
 * Site and news images are public. Everything else (profile photos,
 * documents) is personal data and is served to signed-in staff only, until
 * per-field visibility for alumni profiles is implemented (FR-PROF-03).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const [file] = await query<{ object_key: string; content_type: string; size_bytes: string; purpose: StoredPurpose }>(
    `SELECT object_key, content_type, size_bytes, purpose::text AS purpose FROM file_object WHERE id = $1`,
    [id],
  ).catch(() => []);
  if (!file) return new Response("Not found", { status: 404 });

  const isPublic = PUBLIC_PURPOSES.includes(file.purpose);
  if (!isPublic && !(await getAdminSession())) {
    // 404 rather than 403: do not confirm that a private file exists.
    return new Response("Not found", { status: 404 });
  }

  try {
    const stream = await getObjectStream(file.object_key);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": file.content_type,
        "Content-Length": file.size_bytes,
        // Object keys are immutable UUIDs: a replaced image gets a new id.
        "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[api/files]", err);
    return new Response("Unavailable", { status: 503 });
  }
}
