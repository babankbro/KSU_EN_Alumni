import type { Settings } from "@/lib/server/content";

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Visual Design §5.1 — contact and social links, edited from /admin/content. */
export default function TopBar({ settings }: { settings: Settings }) {
  const social = [
    { href: settings["social.facebook"], label: "Facebook", glyph: "f" },
    { href: settings["social.line"], label: "LINE Official Account", glyph: "L" },
    { href: settings["social.youtube"], label: "YouTube", glyph: "▶" },
  ].filter((s) => s.href);

  return (
    <div className="topbar">
      <div className="wrap">
        <div className="topbar-contact">
          {settings["contact.phone"] ? (
            <a href={telHref(settings["contact.phone"])}>โทร. {settings["contact.phone"]}</a>
          ) : null}
          {settings["contact.email"] ? (
            <a href={`mailto:${settings["contact.email"]}`}>{settings["contact.email"]}</a>
          ) : null}
        </div>
        <div className="topbar-right">
          {social.length > 0 ? (
            <div className="social" aria-label="ช่องทางโซเชียล">
              {social.map((s) => (
                <a key={s.label} href={s.href} aria-label={s.label} rel="noopener noreferrer" target="_blank">
                  {s.glyph}
                </a>
              ))}
            </div>
          ) : null}
          <div className="lang">
            <span className="is-active" aria-current="true">TH</span>
            <a href="#">EN</a>
          </div>
        </div>
      </div>
    </div>
  );
}
