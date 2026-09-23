import Link from "next/link";

export default function SectionHead({
  title,
  sub,
  actionLabel,
  actionHref,
}: {
  title: string;
  sub?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {sub ? <p className="section-sub">{sub}</p> : null}
      </div>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="btn btn-outline btn-sm">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
