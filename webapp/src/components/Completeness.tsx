/** FR-PROF-05 — nudges the owner toward a complete profile. */
export default function Completeness({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="completeness">
      <div
        className="completeness-bar"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="ความสมบูรณ์ของโปรไฟล์"
      >
        <span style={{ width: `${clamped}%` }} />
      </div>
      <p className="completeness-label">ความสมบูรณ์ของโปรไฟล์ {clamped}%</p>
    </div>
  );
}
