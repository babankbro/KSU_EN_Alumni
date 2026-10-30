import "server-only";

/**
 * LINE Login (FR-AUTH-03). Enabled only when LINE_LOGIN_CHANNEL_ID and
 * LINE_LOGIN_CHANNEL_SECRET are set; the faculty must create the channel in
 * the LINE Developers console with callback ${APP_URL}/api/auth/line/callback.
 *
 * This flow is untested against LINE itself in this repository — there are no
 * channel credentials here. The request and response shapes follow the LINE
 * Login v2.1 documentation.
 */

export function lineLoginEnabled(): boolean {
  return Boolean(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET);
}

function callbackUrl(): string {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/auth/line/callback`;
}

export function authorizeUrl(state: string): string {
  const u = new URL("https://access.line.me/oauth2/v2.1/authorize");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.LINE_LOGIN_CHANNEL_ID ?? "");
  u.searchParams.set("redirect_uri", callbackUrl());
  u.searchParams.set("state", state);
  u.searchParams.set("scope", "profile openid");
  return u.toString();
}

/** Exchanges the authorization code and returns the LINE user id. */
export async function exchangeCode(code: string): Promise<{ userId: string; displayName: string }> {
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(),
      client_id: process.env.LINE_LOGIN_CHANNEL_ID ?? "",
      client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET ?? "",
    }),
  });
  if (!tokenRes.ok) throw new Error(`LINE token exchange failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const profRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!profRes.ok) throw new Error(`LINE profile failed: ${profRes.status}`);
  const p = (await profRes.json()) as { userId: string; displayName: string };
  return { userId: p.userId, displayName: p.displayName };
}
