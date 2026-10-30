import "server-only";
import { query } from "./db";

/**
 * Sliding-window rate limits backed by PostgreSQL (FR-AUTH-06, FR-DIR-09).
 *
 * Keys are chosen by the caller and must not depend on the client IP unless
 * it is trustworthy (see client-ip.ts) — inside Docker every request shares
 * one address, so an IP key would throttle everybody at once.
 */

export interface Limit {
  bucket: string;
  max: number;
  windowSec: number;
}

export const LIMITS = {
  /** Wrong identity proof for one student code. */
  claimFailure: { bucket: "claim_fail", max: 5, windowSec: 3600 },
  /** Applications per student code, successful or not. */
  registrationPerCode: { bucket: "register_code", max: 10, windowSec: 86400 },
  /** Whole-site ceiling on applications when the IP cannot be trusted. */
  registrationGlobal: { bucket: "register_all", max: 300, windowSec: 3600 },
  /** Member login failures per email. */
  memberLoginFailure: { bucket: "member_login_fail", max: 5, windowSec: 900 },
  /** Password-reset mails per email. */
  passwordReset: { bucket: "pw_reset", max: 3, windowSec: 3600 },
  /** Directory searches per signed-in account. */
  directorySearch: { bucket: "dir_search", max: 120, windowSec: 600 },
  /** Profile detail views per account (anti-scraping). */
  profileView: { bucket: "profile_view", max: 60, windowSec: 600 },
  /** Anonymous directory traffic as a whole. */
  directoryAnon: { bucket: "dir_anon", max: 2000, windowSec: 600 },
  /** Content reports per account. */
  report: { bucket: "report", max: 20, windowSec: 3600 },
} satisfies Record<string, Limit>;

export async function countHits(limit: Limit, key: string): Promise<number> {
  const [row] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM rate_event
     WHERE bucket = $1 AND key = $2 AND created_at > now() - make_interval(secs => $3)`,
    [limit.bucket, key, limit.windowSec],
  );
  return Number(row?.n ?? 0);
}

export async function isLimited(limit: Limit, key: string): Promise<boolean> {
  return (await countHits(limit, key)) >= limit.max;
}

export async function recordHit(limit: Limit, key: string): Promise<void> {
  await query(`INSERT INTO rate_event (bucket, key) VALUES ($1, $2)`, [limit.bucket, key]);
}

/** Records a hit and reports whether the caller is now over the limit. */
export async function hit(limit: Limit, key: string): Promise<boolean> {
  await recordHit(limit, key);
  return (await countHits(limit, key)) > limit.max;
}

/** Housekeeping, called by the cron task. */
export async function pruneRateEvents(): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM rate_event WHERE created_at < now() - interval '2 days' RETURNING id`,
  );
  return rows.length;
}
