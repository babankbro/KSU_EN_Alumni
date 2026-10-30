import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// §3 Typography — Noto Sans Thai for Thai text, Inter for Latin and numerals.
//
// Self-hosted from @fontsource rather than next/font/google: the Google
// variant downloads the files during `next build`, which made Docker builds
// fail whenever fonts.googleapis.com was unreachable. University build hosts
// often sit behind a filtering proxy, so the build must not need the internet.
//
// Noto Sans Thai carries only the Thai subset; Latin glyphs fall through to
// Inter, which is next in the font stack in globals.css.
// Paths must be plain string literals — next/font rejects computed values.
const notoThai = localFont({
  src: [
    { path: "../../node_modules/@fontsource/noto-sans-thai/files/noto-sans-thai-thai-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/noto-sans-thai/files/noto-sans-thai-thai-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/noto-sans-thai/files/noto-sans-thai-thai-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/noto-sans-thai/files/noto-sans-thai-thai-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-noto-thai",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ศิษย์เก่าวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์",
    template: "%s | ศิษย์เก่าวิศวกรรมศาสตร์ ม.กาฬสินธุ์",
  },
  description:
    "ระบบสารสนเทศศิษย์เก่า คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์ — ทำเนียบศิษย์เก่า ข่าวสาร กิจกรรม และข่าวของศิษย์เก่า",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${notoThai.variable} ${inter.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          ข้ามไปยังเนื้อหาหลัก
        </a>
        {/* Public chrome lives in (site)/layout.tsx; the back office has its own. */}
        {children}
      </body>
    </html>
  );
}
