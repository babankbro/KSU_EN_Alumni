import type { Metadata } from "next";
import PageHead from "@/components/PageHead";
import EventList from "@/components/EventList";
import { EVENTS } from "@/lib/data";

export const metadata: Metadata = {
  title: "กิจกรรม",
  description: "ปฏิทินกิจกรรมศิษย์เก่าคณะวิศวกรรมศาสตร์ ม.กาฬสินธุ์",
};

export default function EventsPage() {
  return (
    <>
      <PageHead
        crumb="กิจกรรม"
        title="ปฏิทินกิจกรรม"
        lead="งานคืนสู่เหย้า กิจกรรมแนะแนวอาชีพ และงานของแต่ละรุ่น"
      />
      <section className="section">
        <div className="wrap">
          <div className="card">
            <EventList events={EVENTS} />
          </div>
        </div>
      </section>
    </>
  );
}
