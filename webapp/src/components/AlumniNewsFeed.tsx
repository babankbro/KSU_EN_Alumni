"use client";

import { useMemo, useState } from "react";
import type { Alumni, AlumniNewsType, AlumniPost } from "@/lib/types";
import { fullName, initials, programName } from "@/lib/data";
import { relativeThai } from "@/lib/format";
import ModerationBadge from "./ModerationBadge";

const TYPES: (AlumniNewsType | "ทั้งหมด")[] = [
  "ทั้งหมด",
  "ความก้าวหน้าในอาชีพ",
  "รางวัล/ความสำเร็จ",
  "ธุรกิจ/ผลงานใหม่",
  "กิจกรรมรุ่น",
  "ข่าวไว้อาลัย",
];

function typeClass(type: AlumniNewsType): string {
  if (type === "รางวัล/ความสำเร็จ") return "tag tag-gold post-type";
  if (type === "ข่าวไว้อาลัย") return "tag tag-memorial post-type";
  if (type === "กิจกรรมรุ่น") return "tag tag-outline post-type";
  return "tag post-type";
}

/**
 * FR-ANEWS-14/15/16 — the alumni-authored feed with type filtering.
 * Pinned posts (FR-ANEWS-20) stay on top regardless of the active filter.
 */
export default function AlumniNewsFeed({
  posts,
  authors,
}: {
  posts: AlumniPost[];
  authors: Alumni[];
}) {
  const [active, setActive] = useState<AlumniNewsType | "ทั้งหมด">("ทั้งหมด");
  const [congrats, setCongrats] = useState<Record<string, boolean>>({});

  const authorById = useMemo(
    () => new Map(authors.map((a) => [a.id, a])),
    [authors],
  );

  const visible = useMemo(() => {
    const filtered =
      active === "ทั้งหมด" ? posts : posts.filter((p) => p.type === active);
    return [...filtered].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.publishedAt.localeCompare(a.publishedAt);
    });
  }, [posts, active]);

  return (
    <>
      <div className="feed-filters" role="group" aria-label="กรองประเภทข่าว">
        {TYPES.map((t) => (
          <button
            key={t}
            className={`chip${active === t ? " is-active" : ""}`}
            aria-pressed={active === t}
            onClick={() => setActive(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <p style={{ marginBottom: 0 }}>ยังไม่มีข่าวในประเภทนี้</p>
        </div>
      ) : null}

      {visible.map((post) => {
        const author = authorById.get(post.authorId);
        const tagged = (post.taggedAlumniIds ?? [])
          .map((id) => authorById.get(id))
          .filter((a): a is Alumni => Boolean(a));
        const liked = congrats[post.id] ?? false;

        return (
          <article
            className={`post${post.isPinned ? " post-pinned" : ""}`}
            key={post.id}
          >
            <div className="post-head">
              <div className="portrait portrait-sm" aria-hidden="true">
                {author ? initials(author) : "??"}
              </div>
              <div>
                <h4>{author ? fullName(author) : "ศิษย์เก่า"}</h4>
                <p className="meta">
                  {author
                    ? `รุ่น ${author.admissionYear} · ${programName(author.programId)} · `
                    : ""}
                  {relativeThai(post.publishedAt)}
                  {post.visibility === "members" ? " · เฉพาะสมาชิก" : ""}
                  {post.visibility === "cohort" ? " · เฉพาะรุ่นเดียวกัน" : ""}
                </p>
              </div>
              <span className={typeClass(post.type)}>{post.type}</span>
            </div>

            <div className="post-body">
              {post.isPinned ? (
                <p style={{ margin: "0 0 6px", fontSize: ".8rem", color: "var(--gold-700)" }}>
                  📌 ข่าวเด่นที่ปักหมุดไว้
                </p>
              ) : null}
              <h3>{post.title}</h3>
              <p>{post.body}</p>
              {tagged.length > 0 ? (
                <p className="post-tagged">
                  แท็ก: {tagged.map((a) => fullName(a)).join(", ")}
                </p>
              ) : null}
            </div>

            <div className="post-foot">
              <button
                className={`react${liked ? " is-on" : ""}`}
                aria-pressed={liked}
                onClick={() =>
                  setCongrats((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                }
              >
                👏 ยินดีด้วย {post.congratsCount + (liked ? 1 : 0)}
              </button>
              <button className="react">💬 ความคิดเห็น {post.commentCount}</button>
              <span style={{ marginLeft: "auto" }}>
                <ModerationBadge status={post.moderationStatus} />
              </span>
            </div>
          </article>
        );
      })}
    </>
  );
}
