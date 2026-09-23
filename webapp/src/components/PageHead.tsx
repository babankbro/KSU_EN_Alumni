import Link from "next/link";

export default function PageHead({
  title,
  lead,
  crumb,
}: {
  title: string;
  lead?: string;
  crumb: string;
}) {
  return (
    <section className="page-head">
      <div className="wrap">
        <p className="breadcrumb">
          <Link href="/">หน้าแรก</Link> / {crumb}
        </p>
        <h1>{title}</h1>
        {lead ? <p>{lead}</p> : null}
      </div>
    </section>
  );
}
