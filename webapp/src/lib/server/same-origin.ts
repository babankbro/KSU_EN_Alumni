import "server-only";

/**
 * CSRF guard for the public JSON / multipart endpoints (server actions get
 * the same check from Next.js itself). Browsers always send Origin on a
 * cross-site POST, so a present-but-foreign Origin is refused; requests with
 * no Origin (curl, server-to-server) carry no victim's cookies anyway.
 */
export function foreignOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set<string>();
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  if (process.env.APP_URL) {
    try {
      allowed.add(new URL(process.env.APP_URL).origin);
    } catch {
      /* ignore a malformed APP_URL */
    }
  }
  return !allowed.has(origin);
}
