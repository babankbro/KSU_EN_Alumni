import ActionForm from "@/components/forms/ActionForm";
import Field, { Check } from "@/components/forms/Field";
import TagPicker from "@/components/me/TagPicker";
import { POST_TYPES, POST_VISIBILITY_LABEL, type PostVisibility } from "@/lib/server/posts";
import { fileUrl } from "@/lib/server/files";
import { savePostAction } from "./actions";

export interface EditablePost {
  id: number;
  type: string;
  title: string;
  body: string;
  visibility: PostVisibility;
  imageFileId: string | null;
  tags: { id: string; name: string }[];
}

/** Shared form for /me/posts/new and /me/posts/[id] (FR-ANEWS-01/02/03/06/07). */
export default function PostEditor({ post, trusted }: { post?: EditablePost; trusted: boolean }) {
  return (
    <ActionForm
      action={savePostAction}
      encType="multipart/form-data"
      submitLabel={trusted ? "เผยแพร่" : "ส่งให้ผู้ตรวจสอบ"}
      pendingLabel="กำลังบันทึก…"
      secondary={
        <button type="submit" name="intent" value="draft" className="btn btn-outline">
          บันทึกฉบับร่าง
        </button>
      }
    >
      {post ? <input type="hidden" name="recordId" value={post.id} /> : null}
      <div className="field-grid">
        <Field as="select" name="type" label="ประเภทข่าว" options={[...POST_TYPES]} emptyLabel="— เลือกประเภท —" defaultValue={post?.type} required />
        <Field
          as="select"
          name="visibility"
          label="ใครเห็นข่าวนี้ได้"
          options={(Object.keys(POST_VISIBILITY_LABEL) as PostVisibility[]).map((v) => ({ value: v, label: POST_VISIBILITY_LABEL[v] }))}
          defaultValue={post?.visibility ?? "members"}
          required
        />
      </div>
      <Field name="title" label="หัวข้อข่าว" defaultValue={post?.title} maxLength={150} required />
      <Field as="textarea" name="body" label="เนื้อหา" rows={8} maxLength={5000} defaultValue={post?.body} required hint="เล่าสั้น ๆ ว่าเกิดอะไรขึ้น เมื่อไร และที่ไหน" />

      <div className="field">
        <label htmlFor="post-image">รูปประกอบ (JPG, PNG, WebP ไม่เกิน 5 MB)</label>
        {post?.imageFileId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(post.imageFileId)} alt="รูปประกอบปัจจุบัน" className="post-image-preview" />
        ) : null}
        <input id="post-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
      </div>
      {post?.imageFileId ? <Check name="removeImage" label="นำรูปประกอบออก" /> : null}

      <TagPicker initial={post?.tags ?? []} />

      <p className="small muted" style={{ margin: 0 }}>
        {trusted
          ? "บัญชีของคุณได้รับสิทธิ์เผยแพร่ทันที ยกเว้นข่าวไว้อาลัยซึ่งต้องผ่านการตรวจสอบเสมอ"
          : "ข่าวจะเผยแพร่หลังผู้ตรวจสอบอนุมัติ โดยทั่วไปไม่เกิน 1 วันทำการ"}
        {" "}การแก้ไขข่าวที่เผยแพร่แล้วจะส่งกลับไปตรวจสอบอีกครั้ง
      </p>
    </ActionForm>
  );
}
