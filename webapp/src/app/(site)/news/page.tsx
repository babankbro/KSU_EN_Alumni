import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import NewsGrid from "@/components/NewsGrid";
import { NEWS } from "@/lib/data";
import { listPublishedNews } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "ข่าวประชาสัมพันธ์",
  description: "ข่าวสารจากคณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม ม.กาฬสินธุ์ และสมาคมศิษย์เก่า",
};

export default async function NewsPage() {
  const news = (await listPublishedNews()) ?? NEWS;

  return (
    <>
      <PageHead
        crumb="ข่าวประชาสัมพันธ์"
        title="ข่าวประชาสัมพันธ์"
        lead="ข่าวสารทางการจากคณะและสมาคมศิษย์เก่า"
      />
      <section className="section">
        <div className="wrap">
          <NewsGrid items={news} />
        </div>
      </section>
    </>
  );
}
