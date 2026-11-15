"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { uploadHomepageMedia, type UploadedMedia } from "@/app/admin/actions";

const sizeLabel=(size:number)=>size>=1024*1024?`${(size/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(size/1024))} KB`;

export function MediaField({
  name,
  label,
  value = "",
  assets: initialAssets,
  kind,
  required = false,
  compact = false,
  onChange,
}: {
  name: string;
  label: string;
  value?: string;
  assets: UploadedMedia[];
  kind: "IMAGE" | "VIDEO" | "DOCUMENT";
  required?: boolean;
  compact?: boolean;
  onChange?: (val: string) => void;
}) {
  const initial = initialAssets.find((asset) => asset.url === value);
  const [selected, setSelected] = useState<UploadedMedia | undefined>(initial);
  const [externalValue, setExternalValue] = useState(initial ? "" : value);
  const [assets, setAssets] = useState(initialAssets);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [imgLoadError, setImgLoadError] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, startUpload] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const currentValue = selected?.url || externalValue;
  const accept =
    kind === "VIDEO"
      ? "video/mp4,video/webm"
      : "image/jpeg,image/png,image/webp,image/avif";

  function chooseFile(file?: File) {
    if (!file) return;
    setError(undefined);
    setMessage(undefined);
    setImgLoadError(false);
    const allowed =
      kind === "VIDEO"
        ? ["video/mp4", "video/webm"]
        : ["image/jpeg", "image/png", "image/webp", "image/avif"];
    const maxMb = kind === "VIDEO" ? 80 : 8;
    if (!allowed.includes(file.type)) {
      setError(
        kind === "VIDEO"
          ? "Unsupported format. Choose an MP4 or WebM video."
          : "Unsupported format. Choose a JPEG, PNG, WebP, or AVIF image."
      );
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(
        kind === "VIDEO"
          ? "Maximum video size is 80 MB."
          : "Maximum image size is 8 MB."
      );
      return;
    }
    const data = new FormData();
    data.set("file", file);
    startUpload(async () => {
      try {
        const result = await uploadHomepageMedia(data, kind);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.asset) {
          setSelected(result.asset);
          setExternalValue("");
          setImgLoadError(false);
          setAssets((current) => [
            result.asset!,
            ...current.filter((asset) => asset.id !== result.asset!.id),
          ]);
          setMessage(
            "Upload complete. Selected for this field — save this page to publish this assignment."
          );
          onChange?.(result.asset.url);
        }
      } catch {
        setError("Upload failed. Check your connection and try again.");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function remove() {
    setSelected(undefined);
    setExternalValue("");
    setImgLoadError(false);
    setMessage("Assignment removed — save this page to persist the change.");
    setError(undefined);
    onChange?.("");
  }

  return (
    <div className={`media-field ${compact ? "media-field-compact" : ""}`}>
      <input type="hidden" name={name} value={currentValue} required={required} />
      <div className="media-field-heading">
        <strong>{label}</strong>
        <span className={`media-kind ${kind.toLowerCase()}`}>{kind}</span>
      </div>
      {currentValue ? (
        <div
          className="media-preview"
          style={
            compact
              ? {
                  width: "160px",
                  aspectRatio: "16/10",
                  marginBottom: "8px",
                  borderRadius: "6px",
                  position: "relative",
                  overflow: "hidden",
                }
              : undefined
          }
        >
          {kind === "VIDEO" ? (
            <video src={currentValue} controls muted playsInline preload="metadata" />
          ) : imgLoadError ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#1c2b23",
                color: "#e2ded7",
                padding: "8px",
                textAlign: "center",
                fontSize: "11px",
              }}
            >
              <span>Image unavailable</span>
              <span style={{ fontSize: "10px", opacity: 0.7, marginTop: "4px" }}>
                Click Replace to upload
              </span>
            </div>
          ) : (
            <Image
              src={currentValue}
              alt=""
              fill
              sizes={compact ? "180px" : "520px"}
              onError={() => setImgLoadError(true)}
            />
          )}
        </div>
      ) : (
        <p className="media-empty" style={compact ? { padding: "12px", fontSize: "12px" } : undefined}>
          No {kind.toLowerCase()} selected.
        </p>
      )}
      {currentValue && (
        <div className="media-meta" style={compact ? { fontSize: "11px", marginBottom: "6px" } : undefined}>
          <b>{selected?.filename || (imgLoadError ? "Referenced URL (Missing)" : "Existing media")}</b>
          <span>
            {selected
              ? `${selected.mimeType} · ${sizeLabel(selected.size)}`
              : currentValue}
          </span>
        </div>
      )}
      <div className="media-actions" style={compact ? { gap: "6px", flexWrap: "wrap" } : undefined}>
        <button
          type="button"
          className="secondary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          style={compact ? { padding: "5px 10px", fontSize: "12px" } : undefined}
        >
          {uploading
            ? "Uploading…"
            : currentValue
            ? `Replace ${kind === "VIDEO" ? "Video" : "Image"}`
            : `Upload ${kind === "VIDEO" ? "Video" : "Image"}`}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={uploading}
          onClick={() => setLibraryOpen(true)}
          style={compact ? { padding: "5px 10px", fontSize: "12px" } : undefined}
        >
          Choose From Library
        </button>
        {currentValue && (
          <button
            type="button"
            className="media-remove"
            disabled={uploading}
            onClick={remove}
            style={compact ? { padding: "5px 10px", fontSize: "12px" } : undefined}
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        tabIndex={-1}
        type="file"
        accept={accept}
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />
      {uploading && (
        <p className="media-status" role="status">
          Uploading… Please keep this page open.
        </p>
      )}
      {message && (
        <p className="media-status success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="media-status error" role="alert">
          {error}
        </p>
      )}
      {libraryOpen && (
        <div
          className="media-library-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLibraryOpen(false);
          }}
        >
          <div
            className="media-library-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Choose ${label}`}
          >
            <div className="section-title">
              <div>
                <h3>Choose From Media Library</h3>
                <p className="hint">Showing compatible {kind.toLowerCase()} media only.</p>
              </div>
              <button
                type="button"
                className="media-remove"
                onClick={() => setLibraryOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="media-library-options">
              {assets.length ? (
                assets.map((asset) => (
                  <button
                    type="button"
                    key={asset.id}
                    className={asset.url === currentValue ? "selected" : ""}
                    onClick={() => {
                      setSelected(asset);
                      setExternalValue("");
                      setImgLoadError(false);
                      setMessage(
                        "Media selected — save this page to publish this assignment."
                      );
                      setError(undefined);
                      setLibraryOpen(false);
                      onChange?.(asset.url);
                    }}
                  >
                    <span className="media-library-thumb">
                      {kind === "VIDEO" ? (
                        <video src={asset.url} muted playsInline preload="metadata" />
                      ) : (
                        <Image src={asset.url} alt="" fill sizes="200px" />
                      )}
                    </span>
                    <b>{asset.filename}</b>
                    <span>
                      {asset.mimeType} · {sizeLabel(asset.size)}
                    </span>
                  </button>
                ))
              ) : (
                <p className="empty">
                  No compatible media yet. Close this window and use Upload.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
