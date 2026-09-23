export default function TopBar() {
  return (
    <div className="topbar">
      <div className="wrap">
        <div className="topbar-contact">
          <a href="tel:043602053">โทร. 043-602-053</a>
          <a href="mailto:alumni.eng@ksu.ac.th">alumni.eng@ksu.ac.th</a>
        </div>
        <div className="topbar-right">
          <div className="social" aria-label="ช่องทางโซเชียล">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="LINE Official Account">L</a>
            <a href="#" aria-label="YouTube">▶</a>
          </div>
          <div className="lang">
            <span className="is-active" aria-current="true">TH</span>
            <a href="#">EN</a>
          </div>
        </div>
      </div>
    </div>
  );
}
