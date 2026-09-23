import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import NewsGrid from "@/components/NewsGrid";
import { NEWS } from "@/lib/data";

export const metadata: Metadata = {
  title: "ข่าวประชาสัมพันธ์",
  description: "ข่าวสารจากคณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์ และสมาคมศิษย์เก่า",
};

export default function NewsPage() {
  return (
    <>
      <PageHead
        crumb="ข่าวประชาสัมพันธ์"
        title="ข่าวประชาสัมพันธ์"
        lead="ข่าวสารทางการจากคณะและสมาคมศิษย์เก่า"
      />
      <section className="section">
        <div className="wrap">
          <NewsGrid items={NEWS} />
        </div>
      </section>
    </>
  );
}
