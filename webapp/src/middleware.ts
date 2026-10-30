import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap first gate for the back office: no session cookie, no admin page.
 *
 * This only checks that a cookie is present — middleware runs on the edge
 * runtime and cannot reach PostgreSQL. The real check (token hash, expiry,
 * active account) happens in requireAdmin() on every admin page and action.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  if (!req.cookies.get("ksu_admin_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
