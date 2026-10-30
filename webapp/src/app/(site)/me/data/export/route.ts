import { getMemberAccount } from "@/lib/server/member-auth";
import { exportPersonalData } from "@/lib/server/profile";
import { query } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** FR-PROF-08 — the owner's own data as a JSON download. */
export async function GET() {
  const acc = await getMemberAccount();
  if (!acc?.alumniId) return new Response("Not found", { status: 404 });

  const data = await exportPersonalData(acc.alumniId, acc.id);
  await query(
    `INSERT INTO audit_log (actor, action, target_table, target_id) VALUES ($1, 'pdpa.export', 'alumni', $2)`,
    [`account:${acc.id}`, acc.alumniId],
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-alumni-data-${stamp}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
