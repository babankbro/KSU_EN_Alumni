import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "ระบบจัดการ", template: "%s | ระบบจัดการศิษย์เก่า" },
  // The back office must never be indexed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
