import DraftBanner from "@/components/DraftBanner";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getSettings } from "@/lib/server/content";

// Texts and images on the public site are edited from /admin/content, so
// pages render per request rather than being frozen at build time. This also
// keeps `next build` from needing a database.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <>
      <DraftBanner />
      <TopBar settings={settings} />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
