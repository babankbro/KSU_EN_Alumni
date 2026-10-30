import Link from "next/link";
import type { Settings } from "@/lib/server/content";

export default function SiteFooter({ settings }: { settings: Settings }) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <span className="brand-mark" aria-hidden="true">KSU</span>
              <div>
                <strong>ศิษย์เก่าวิศวกรรมศาสตร์</strong>
                <br />
                <span style={{ fontSize: ".82rem" }}>มหาวิทยาลัยกาฬสินธุ์</span>
              </div>
            </div>
            <p style={{ fontSize: ".88rem" }}>{settings["footer.about"]}</p>
          </div>

          <div>
            <h4>ผังเว็บไซต์</h4>
            <ul>
              <li><Link href="/">หน้าแรก</Link></li>
              <li><Link href="/directory">ทำเนียบศิษย์เก่า</Link></li>
              <li><Link href="/alumni-news">ข่าวศิษย์เก่า</Link></li>
              <li><Link href="/news">ข่าวประชาสัมพันธ์</Link></li>
              <li><Link href="/events">กิจกรรม</Link></li>
            </ul>
          </div>

          <div>
            <h4>บริการ</h4>
            <ul>
              <li><Link href="/privileges">สิทธิประโยชน์ศิษย์เก่า</Link></li>
              <li><Link href="/alumni-news">ส่งข่าวของศิษย์เก่า</Link></li>
              <li><a href="#">ประกาศรับสมัครงาน</a></li>
              <li><a href="#">แบบสำรวจภาวะการมีงานทำ</a></li>
              <li><a href="#">เสนอชื่อศิษย์เก่าดีเด่น</a></li>
            </ul>
          </div>

          <div>
            <h4>ติดต่อ</h4>
            <ul>
              <li>{settings["contact.unit"]}</li>
              <li>{settings["contact.address"]}</li>
              {settings["contact.phone"] ? (
                <li><a href={`tel:${settings["contact.phone"].replace(/[^\d+]/g, "")}`}>{settings["contact.phone"]}</a></li>
              ) : null}
              {settings["contact.email"] ? (
                <li><a href={`mailto:${settings["contact.email"]}`}>{settings["contact.email"]}</a></li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © 2569 คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยกาฬสินธุ์ — เว็บไซต์ร่างเพื่อการออกแบบระบบ
          </span>
          <span>
            <a href="#">นโยบายความเป็นส่วนตัว (PDPA)</a> · <Link href="/admin">สำหรับเจ้าหน้าที่</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
