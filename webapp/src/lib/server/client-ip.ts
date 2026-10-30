import "server-only";

/**
 * The client's IP address — or null when it cannot be known.
 *
 * Inside Docker every request reaches the app from the bridge gateway, and
 * the Next.js server fills X-Forwarded-For with that gateway address. Taken at
 * face value, all visitors would share one IP: an IP-based lockout would lock
 * out every member of staff at once, and consent records would carry a
 * meaningless address.
 *
 * So X-Forwarded-For is trusted only when the operator declares a reverse
 * proxy that sets it (TRUST_PROXY=true). Otherwise this returns null, and
 * callers fall back to per-account limits.
 */
export function clientIpFrom(headers: Headers): string | null {
  if (process.env.TRUST_PROXY !== "true") return null;
  const fwd = headers.get("x-forwarded-for");
  // Left-most entry is the original client when every hop appends.
  const ip = fwd?.split(",")[0]?.trim();
  return ip || headers.get("x-real-ip") || null;
}
