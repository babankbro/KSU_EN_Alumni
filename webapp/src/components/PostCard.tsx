import Link from "next/link";
import type { PostCardData } from "@/lib/server/posts";
import { formatThaiDateOnly } from "@/lib/server/format-server";
import { toggleReactionAction } from "@/app/(site)/alumni-news/actions";

function typeClass(type: string): string {
  if (type === "รางวัล/ความสำเร็จ") return "tag tag-gold post-type";
  if (type === "ข่าวไว้อาลัย") return "tag tag-memorial post-type";
  if (type === "กิจกรรมรุ่น") return "tag tag-outline post-type";
  return "tag post-type";
}

/**
 * One published alumni post (FR-ANEWS-14/16/18). Author and tagged people
 * link to their directory profile only when they are listed there.
 * `full` shows the whole body on the detail page; the feed shows an excerpt.
 */
export default function PostCard({
  post,
  canReact,
  full = false,
  back,
}: {
  post: PostCardData;
  canReact: boolean;
  full?: boolean;
  back?: string;
}) {
  const person = (p: { id: string; name: string; listed: boolean }) =>
    p.listed ? <Link href={`/directory/${p.id}`}>{p.name}</Link> : <span>{p.name}</span>;
  const excerpt = !full && post.body.length > 320 ? `${post.body.slice(0, 320)}…` : post.body;

  return (
    <article className={`post${post.isPinned ? " post-pinned" : ""}`}>
      <div className="post-head">
        <div className="portrait portrait-sm" aria-hidden="true">
          {post.author.name.replace(/^(นาย|นางสาว|นาง|ดร\.)/, "").slice(0, 2)}
        </div>
        <div>
          <h4>{person(post.author)}</h4>
          <p className="meta">
            รุ่น {post.author.admissionYear} · {post.author.program} · {formatThaiDateOnly(post.publishedAt)}
            {post.visibility === "members" ? " · เฉพาะสมาชิก" : ""}
            {post.visibility === "cohort" ? " · เฉพาะรุ่นเดียวกัน" : ""}
          </p>
        </div>
        <span className={typeClass(post.type)}>{post.type}</span>
      </div>

      <div className="post-body">
        {post.isPinned ? <p className="post-pin-note">📌 ข่าวเด่นที่ปักหมุดไว้</p> : null}
        <h3>{full ? post.title : <Link href={`/alumni-news/${post.id}`}>{post.title}</Link>}</h3>
        {post.imageUrl ? (
          // Served by /api/files with the post's own visibility check.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="post-image" src={post.imageUrl} alt="" loading="lazy" />
        ) : null}
        <p className="post-text">{excerpt}</p>
        {!full && excerpt !== post.body ? <Link href={`/alumni-news/${post.id}`}>อ่านต่อ</Link> : null}
        {post.tagged.length > 0 ? (
          <p className="post-tagged">
            แท็ก:{" "}
            {post.tagged.map((t, i) => (
              <span key={t.id}>{i ? ", " : ""}{person(t)}</span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="post-foot">
        {canReact ? (
          <form action={toggleReactionAction}>
            <input type="hidden" name="postId" value={post.id} />
            {back ? <input type="hidden" name="back" value={back} /> : null}
            <button type="submit" className={`react${post.reacted ? " is-on" : ""}`} aria-pressed={post.reacted}>
              👏 ยินดีด้วย {post.congrats}
            </button>
          </form>
        ) : (
          <span className="react" title="เข้าสู่ระบบเพื่อแสดงความยินดี">👏 ยินดีด้วย {post.congrats}</span>
        )}
        <Link className="react" href={`/alumni-news/${post.id}#comments`}>💬 ความคิดเห็น {post.comments}</Link>
      </div>
    </article>
  );
}
