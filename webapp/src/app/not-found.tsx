import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="empty-state">
          <h1 style={{ fontSize: "1.4rem" }}>ไม่พบหน้าที่ต้องการ</h1>
          <p>หน้าที่คุณเปิดอาจถูกย้ายหรือยังไม่ได้จัดทำในเว็บไซต์ร่างนี้</p>
          <Link href="/" className="btn btn-primary">
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    </section>
  );
}
