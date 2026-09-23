import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import DirectoryExplorer from "@/components/DirectoryExplorer";
import { ALUMNI, FACETS } from "@/lib/data";

export const metadata: Metadata = {
  title: "ทำเนียบศิษย์เก่า",
  description:
    "ค้นหาศิษย์เก่าคณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์ ตามรุ่น สาขา จังหวัด องค์กร และทักษะ",
};

export default function DirectoryPage() {
  const total = ALUMNI.length;

  return (
    <>
      <PageHead
        crumb="ทำเนียบศิษย์เก่า"
        title="ทำเนียบศิษย์เก่า"
        lead="ค้นหาเพื่อนร่วมรุ่นและรุ่นพี่รุ่นน้องได้หลายมิติพร้อมกัน — รุ่น สาขาวิชา จังหวัด องค์กรที่ทำงาน กลุ่มอาชีพ และทักษะวิชาชีพ"
      />
      <section className="section">
        <div className="wrap">
          <DirectoryExplorer people={ALUMNI} facets={FACETS} />
        </div>
      </section>
    </>
  );
}
