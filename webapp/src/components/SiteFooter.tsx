import Link from "next/link";

export default function SiteFooter() {
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
            <p style={{ fontSize: ".88rem" }}>
              เครือข่ายศิษย์เก่าคณะวิศวกรรมศาสตร์ เพื่อเชื่อมโยงรุ่นพี่รุ่นน้อง
              ส่งต่อโอกาสทางอาชีพ และร่วมพัฒนาหลักสูตรของคณะ
            </p>
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
              <li>คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์</li>
              <li>อ.เมือง จ.กาฬสินธุ์ 46000</li>
              <li><a href="tel:043602053">043-602-053</a></li>
              <li><a href="mailto:alumni.eng@ksu.ac.th">alumni.eng@ksu.ac.th</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © 2569 คณะวิศวกรรมศาสตร์ มหาวิทยาลัยกาฬสินธุ์ — เว็บไซต์ร่างเพื่อการออกแบบระบบ
          </span>
          <span>
            <a href="#">นโยบายความเป็นส่วนตัว (PDPA)</a> · <a href="#">ผังเว็บไซต์</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
