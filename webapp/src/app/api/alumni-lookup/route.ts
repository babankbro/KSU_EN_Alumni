import { query } from "@/lib/server/db";
import { getViewer, isMember, viewerAccount } from "@/lib/server/member-auth";
import { hit, LIMITS } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/alumni-lookup?q= — name lookup for the tag picker (FR-ANEWS-03).
 * Verified members and staff only; returns names, cohort and programme of
 * people listed in the directory, nothing more. Shares the directory search
 * rate limit so it cannot be used to page through the whole directory.
 */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!isMember(viewer)) return Response.json({ people: [] }, { status: 401 });
  const account = viewerAccount(viewer);
  if (account && (await hit(LIMITS.directorySearch, account.id))) {
    return Response.json({ people: [], error: "ค้นหาถี่เกินไป กรุณารอสักครู่" }, { status: 429 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return Response.json({ people: [] });

  const people = await query<{ id: string; name: string; cohort: number; program: string }>(
    `SELECT d.id, d.first_name_th || ' ' || d.last_name_th AS name, d.admission_year AS cohort, d.program_current_name_th AS program
     FROM directory_public d
     WHERE (d.first_name_th || ' ' || d.last_name_th) ILIKE $1 OR d.nickname ILIKE $1
        OR EXISTS (SELECT 1 FROM alumni_former_name f WHERE f.alumni_id = d.id AND (f.first_name_th || ' ' || f.last_name_th) ILIKE $1)
     ORDER BY d.first_name_th LIMIT 8`,
    [`%${q}%`],
  );
  return Response.json({ people }, { headers: { "Cache-Control": "private, no-store" } });
}
