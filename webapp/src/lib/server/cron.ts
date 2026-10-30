import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { query } from "./db";
import { deliverPending, enqueue, sendWeeklyDigests } from "./notify";
import { pruneRateEvents } from "./rate-limit";
import { storeUpload } from "./files";
import { formatThaiDateTime } from "./format-server";

/**
 * Scheduled work, run by the `cron` service calling /api/internal/cron once a
 * minute. Each task records when it last ran in `cron_run`, so the interval
 * logic survives restarts and a task never runs twice in its window.
 */

async function due(task: string, everySeconds: number): Promise<boolean> {
  const rows = await query<{ task: string }>(
    `INSERT INTO cron_run (task, last_run) VALUES ($1, now())
     ON CONFLICT (task) DO UPDATE SET last_run = now()
       WHERE cron_run.last_run < now() - make_interval(secs => $2)
     RETURNING task`,
    [task, everySeconds],
  );
  return rows.length > 0;
}

/** FR-EVT-05 — remind registrants roughly a day before the event. */
async function eventReminders(): Promise<number> {
  const rows = await query<{ event_id: number; title: string; starts_at: Date; venue: string | null; account_id: string; alumni_id: string }>(
    `SELECT e.id AS event_id, e.title, e.starts_at, e.venue, ac.id AS account_id, r.alumni_id
     FROM event_registration r
     JOIN event e ON e.id = r.event_id
     JOIN account ac ON ac.alumni_id = r.alumni_id
     WHERE r.cancelled_at IS NULL AND r.reminded_at IS NULL AND e.is_published
       AND e.starts_at BETWEEN now() AND now() + interval '36 hours'`,
  );
  for (const r of rows) {
    await enqueue("event_reminder", [r.account_id], {
      title: `พรุ่งนี้: ${r.title}`,
      body: `กิจกรรมที่คุณลงทะเบียนไว้จะเริ่ม ${formatThaiDateTime(r.starts_at)}${r.venue ? ` ที่ ${r.venue}` : ""}`,
      link: `/events/${r.event_id}`,
      dedupeKey: `event-reminder:${r.event_id}`,
    });
    await query(`UPDATE event_registration SET reminded_at = now() WHERE event_id = $1 AND alumni_id = $2`, [r.event_id, r.alumni_id]);
  }
  return rows.length;
}

/** FR-JOB-06 — tell people whose programme or skills match a newly approved job. */
async function jobMatches(): Promise<number> {
  const jobs = await query<{ id: number; title: string; organization: string }>(
    `SELECT id, title, organization FROM job_post
     WHERE moderation_status = 'approved' AND matched_notified_at IS NULL
       AND (closes_at IS NULL OR closes_at >= current_date)`,
  );
  let total = 0;
  for (const j of jobs) {
    const rows = await query<{ account_id: string }>(
      `SELECT DISTINCT ac.id AS account_id
       FROM account ac
       LEFT JOIN alumni a ON a.id = ac.alumni_id
       WHERE ac.is_active AND (ac.role = 'student' OR a.claim_status = 'verified')
         AND a.id IS DISTINCT FROM (SELECT posted_by FROM job_post WHERE id = $1) AND (
         EXISTS (SELECT 1 FROM job_post_skill js JOIN alumni_skill s ON s.skill_id = js.skill_id
                 WHERE js.job_post_id = $1 AND s.alumni_id = a.id)
         OR EXISTS (SELECT 1 FROM job_post_program jp
                    JOIN program_resolved pr ON pr.current_id = (SELECT current_id FROM program_resolved WHERE id = jp.program_id)
                    WHERE jp.job_post_id = $1 AND pr.id = a.program_id)
         OR (ac.role = 'student' AND NOT EXISTS (SELECT 1 FROM job_post_program WHERE job_post_id = $1))
       )`,
      [j.id],
    );
    total += await enqueue("job_match", rows.map((r) => r.account_id), {
      title: `ประกาศงานใหม่: ${j.title}`,
      body: `${j.organization} — ตรงกับสาขาหรือทักษะในโปรไฟล์ของคุณ`,
      link: `/jobs/${j.id}`,
      dedupeKey: `job-match:${j.id}`,
    });
    await query(`UPDATE job_post SET matched_notified_at = now() WHERE id = $1`, [j.id]);
  }
  return total;
}

/**
 * Development convenience: attach the bundled sample photos to the fictional
 * seed alumni and events, so the demo looks like the design. Off unless
 * DEMO_SEED_MEDIA=true, and it never touches a record that already has one.
 */
async function seedDemoMedia(): Promise<number> {
  if (process.env.DEMO_SEED_MEDIA !== "true") return 0;
  const people: [string, string][] = [
    ["00000000-0000-4000-8000-000000000005", "profile-somchai.png"],
    ["00000000-0000-4000-8000-000000000006", "profile-nalin.png"],
    ["00000000-0000-4000-8000-000000000007", "profile-kittipong.png"],
    ["00000000-0000-4000-8000-000000000008", "profile-pimchanok.png"],
  ];
  const events: [string, string][] = [
    ["คืนสู่เหย้า%", "event-homecoming.png"],
    ["เปิดบ้านอาชีพ%", "event-connect.png"],
    ["Job Fair%", "event-robotics.png"],
  ];
  const dir = path.join(process.cwd(), "public", "images");
  let n = 0;
  const load = async (name: string) => {
    const buf = await fs.readFile(path.join(dir, name));
    return new File([buf], name, { type: "image/png" });
  };
  for (const [id, file] of people) {
    const [a] = await query<{ has: boolean }>(`SELECT photo_file_id IS NOT NULL AS has FROM alumni WHERE id = $1`, [id]);
    if (!a || a.has) continue;
    const stored = await storeUpload(await load(file), "profile_photo", { uploadedBy: "demo-seed", ownerAlumniId: id });
    await query(`UPDATE alumni SET photo_file_id = $2 WHERE id = $1`, [id, stored.id]);
    n++;
  }
  for (const [title, file] of events) {
    const [e] = await query<{ id: number; has: boolean }>(`SELECT id, cover_file_id IS NOT NULL AS has FROM event WHERE title LIKE $1 LIMIT 1`, [title]);
    if (!e || e.has) continue;
    const stored = await storeUpload(await load(file), "site_image", { uploadedBy: "demo-seed" });
    await query(`UPDATE event SET cover_file_id = $2 WHERE id = $1`, [e.id, stored.id]);
    n++;
  }
  return n;
}

export async function runCron(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const run = async (name: string, every: number, fn: () => Promise<unknown>) => {
    try {
      if (await due(name, every)) out[name] = await fn();
    } catch (err) {
      out[name] = `error: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[cron] ${name}`, err);
    }
  };
  await run("demo_media", 3600, seedDemoMedia);
  await run("job_matches", 60, jobMatches);
  await run("event_reminders", 600, eventReminders);
  await run("weekly_digest", 7 * 86400, sendWeeklyDigests);
  await run("prune_rate_events", 86400, pruneRateEvents);
  // Delivery last, so anything queued above goes out in the same run.
  await run("deliver", 0, () => deliverPending());
  return out;
}
