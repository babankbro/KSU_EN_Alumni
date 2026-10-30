import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import JobCard from "@/components/JobCard";
import { JOB_POSTS } from "@/lib/data";

export const metadata: Metadata = {
  title: "งานและฝึกงาน",
  description:
    "ตำแหน่งงานและที่ฝึกงานที่ศิษย์เก่าคณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์ แบ่งปันให้รุ่นน้อง",
};

export default function JobsPage() {
  return (
    <>
      <PageHead
        crumb="งานและฝึกงาน"
        title="งานและฝึกงาน"
        lead="ตำแหน่งงาน ที่ฝึกงาน และสหกิจศึกษาที่ศิษย์เก่าแบ่งปันมาถึงรุ่นน้องโดยตรง"
      />
      <section className="section">
        <div className="wrap">
          <div className="grid grid-3">
            {JOB_POSTS.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>

          <div className="privacy-note">
            <p>
              <strong>สำหรับศิษย์เก่า:</strong> ประกาศงานทุกชิ้นผ่านการตรวจสอบก่อนเผยแพร่
              และจะหมดอายุอัตโนมัติเมื่อเลยวันปิดรับ
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
