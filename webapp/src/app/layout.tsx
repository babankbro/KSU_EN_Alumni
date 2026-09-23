import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import DraftBanner from "@/components/DraftBanner";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

// §3 Typography — Noto Sans Thai for Thai text, Inter for Latin and numerals.
const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-thai",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
        <DraftBanner />
        <TopBar />
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
