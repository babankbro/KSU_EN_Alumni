import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHead from "@/components/PageHead";
import { query } from "@/lib/server/db";
import { fileUrl } from "@/lib/server/files";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function album(id: number) {
  const [a] = await query<{ title: string; description: string | null; event_id: number | null; event: string | null }>(
    `SELECT g.title, g.description, g.event_id, e.title AS event FROM gallery_album g LEFT JOIN event e ON e.id = g.event_id
     WHERE g.id = $1 AND g.is_published`,
    [id],
  );
  return a ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number((await params).id);
  const a = Number.isInteger(id) ? await album(id) : null;
  return { title: a?.title ?? "แกลเลอรี" };
}

export default async function AlbumPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const a = await album(id);
  if (!a) notFound();
  const photos = await query<{ file_id: string; caption: string | null }>(
    `SELECT file_id, caption FROM gallery_photo WHERE album_id = $1 ORDER BY sort, id`,
    [id],
  );
  return (
    <>
      <PageHead crumb="แกลเลอรี" title={a.title} lead={a.description ?? `${photos.length} รูป`} />
      <section className="section">
        <div className="wrap">
          <p className="small">
            <Link href="/gallery">← อัลบั้มทั้งหมด</Link>
            {a.event_id ? <> · กิจกรรม: <Link href={`/events/${a.event_id}`}>{a.event}</Link></> : null}
          </p>
          <div className="gallery-grid">
            {photos.map((p) => (
              <figure key={p.file_id}>
                <a href={fileUrl(p.file_id)} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(p.file_id)} alt={p.caption ?? `ภาพจาก ${a.title}`} loading="lazy" />
                </a>
                {p.caption ? <figcaption>{p.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
