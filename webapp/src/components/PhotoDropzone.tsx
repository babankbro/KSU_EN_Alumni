"use client";

import { useId, useRef, useState } from "react";
import {
  PHOTO_ACCEPT,
  PHOTO_ACCEPT_LABEL,
  PHOTO_MAX_BYTES,
  formatBytes,
  validatePhotoFile,
  type PhotoState,
} from "@/lib/registration";

/**
 * FR-PROF-10 — profile photo picker.
 *
 * Drag-and-drop is an accelerator, never the only route: the same area is a
 * real <input type="file"> wrapped in a label, so it is reachable by keyboard
 * and by tapping on a touch device. Visual Design §7 forbids interactions that
 * only work on hover, and dragging is exactly that kind of interaction.
 *
 * Nothing is uploaded in this draft — the preview is a local object URL.
 */
export default function PhotoDropzone({
  photo,
  onChange,
}: {
  photo: PhotoState | null;
  onChange: (next: PhotoState | null) => void;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Counts enter/leave so moving over a child element does not clear the state.
  const dragDepth = useRef(0);

  function accept(file: File | undefined) {
    if (!file) return;

    const problem = validatePhotoFile(file);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    // Release the previous preview before replacing it.
    if (photo) URL.revokeObjectURL(photo.previewUrl);

    onChange({
      fileName: file.name,
      sizeBytes: file.size,
      type: file.type,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function remove() {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="photo-field">
      <span className="field-label" id={`${inputId}-label`}>
        รูปโปรไฟล์
        <span className="optional"> (ไม่บังคับ)</span>
      </span>

      <div className="photo-row">
        {photo ? (
          <figure className="photo-preview">
            {/* A local blob URL cannot go through next/image optimisation. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.previewUrl} alt="ตัวอย่างรูปโปรไฟล์ที่เลือก" />
            <figcaption>
              <strong>{photo.fileName}</strong>
              <span>{formatBytes(photo.sizeBytes)}</span>
              <button type="button" className="link-danger" onClick={remove}>
                นำรูปออก
              </button>
            </figcaption>
          </figure>
        ) : null}

        <label
          htmlFor={inputId}
          className={`dropzone${dragging ? " is-dragging" : ""}${error ? " has-error" : ""}`}
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(e) => {
            // Required, otherwise the browser opens the file instead.
            e.preventDefault();
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            dragDepth.current -= 1;
            if (dragDepth.current <= 0) {
              dragDepth.current = 0;
              setDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            accept(e.dataTransfer.files?.[0]);
          }}
        >
          <span className="dropzone-icon" aria-hidden="true">
            🖼
          </span>
          <span className="dropzone-text">
            <strong>ลากรูปมาวางที่นี่</strong>
            <span>หรือกดเพื่อเลือกไฟล์จากเครื่อง</span>
          </span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="sr-only"
            accept={PHOTO_ACCEPT.join(",")}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            onChange={(e) => accept(e.target.files?.[0])}
          />
        </label>
      </div>

      <p className="field-hint" id={hintId}>
        {PHOTO_ACCEPT_LABEL} · ขนาดไม่เกิน {formatBytes(PHOTO_MAX_BYTES)} ·
        แนะนำรูปหน้าตรงสัดส่วนจัตุรัส
      </p>

      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}

      <p className="field-hint">
        รูปโปรไฟล์จะแสดงในทำเนียบศิษย์เก่าตามระดับความเป็นส่วนตัวที่คุณเลือกในขั้นถัดไป
      </p>
    </div>
  );
}
