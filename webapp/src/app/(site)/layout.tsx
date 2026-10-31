import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getSettings } from "@/lib/server/content";
import { getMemberAccount } from "@/lib/server/member-auth";
import { query } from "@/lib/server/db";

// Texts and images on the public site are edited from /admin/content, so
// pages render per request rather than being frozen at build time. This also
// keeps `next build` from needing a database.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, account] = await Promise.all([getSettings(), getMemberAccount()]);

  let member: { displayName: string; unread: number } | null = null;
  if (account) {
    const [r] = await query<{ n: string }>(
      `SELECT count(*) AS n FROM notification WHERE account_id = $1 AND channel = 'in_app' AND read_at IS NULL`,
      [account.id],
    ).catch(() => [{ n: "0" }]);
    member = { displayName: account.displayName, unread: Number(r?.n ?? 0) };
  }

  return (
    <>
      <TopBar settings={settings} />
      <SiteHeader member={member} />
      <main id="main">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
