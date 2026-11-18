"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";

export interface SectionMediaAsset {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  kind?: string;
  altEn?: string | null;
  altAr?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface SectionImageFieldProps {
  sectionId: string;
  imageUrl: string;
  imageAltEn: string;
  imageAltAr: string;
  existingAssets?: SectionMediaAsset[];
  onImageChange: (sectionId: string, url: string, asset?: Partial<SectionMediaAsset>) => void;
  onAltChange: (sectionId: string, patch: { imageAltEn?: string; imageAltAr?: string }) => void;
  onUploadStateChange?: (sectionId: string, isUploading: boolean) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getDisplayFilename(url: string, asset?: SectionMediaAsset): string {
  if (asset?.filename) return asset.filename;
  if (!url) return "";
  try {
    const cleanUrl = url.split("?")[0];
    const segments = cleanUrl.split("/");
    const last = segments[segments.length - 1];
    return decodeURIComponent(last || url);
  } catch {
    return url;
  }
}

export function SectionImageField({
  sectionId,
  imageUrl,
  imageAltEn,
  imageAltAr,
  existingAssets = [],
  onImageChange,
  onAltChange,
  onUploadStateChange,
}: SectionImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadSeqRef = useRef<number>(0);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastFailedFile, setLastFailedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState("");
  const [imgLoadError, setImgLoadError] = useState(false);

  // Match asset from existing library to show rich metadata (size, dimensions)
  const matchedAsset = existingAssets.find((a) => a.url === imageUrl);
  const displayFilename = getDisplayFilename(imageUrl, matchedAsset);

  // Reset load error state whenever imageUrl changes
  useEffect(() => {
    setImgLoadError(false);
  }, [imageUrl]);

  const uploadFile = useCallback(
    (file: File) => {
      // 1. Client-side format & size check
      const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const validExtensions = ["jpg", "jpeg", "png", "webp", "avif"];
      const maxBytes = 12 * 1024 * 1024; // 12 MB

      if (!validMimeTypes.includes(file.type) && !validExtensions.includes(ext)) {
        setUploadStatus("error");
        setErrorMessage("Unsupported file format. Please upload a JPEG, PNG, WebP, or AVIF image.");
        setLastFailedFile(null);
        return;
      }

      if (file.size > maxBytes) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        setUploadStatus("error");
        setErrorMessage(`File is too large (${sizeMb} MB). Maximum allowed image size is 12 MB.`);
        setLastFailedFile(null);
        return;
      }

      setErrorMessage(null);
      setSuccessMessage(null);
      setUploadStatus("uploading");
      setUploadProgress(0);
      setLastFailedFile(file);
      onUploadStateChange?.(sectionId, true);

      // Increment upload sequence number to discard any earlier out-of-order responses
      const currentSeq = ++activeUploadSeqRef.current;
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "IMAGE");
      if (imageAltEn) formData.append("altEn", imageAltEn);
      if (imageAltAr) formData.append("altAr", imageAltAr);

      xhr.upload.addEventListener("progress", (event) => {
        if (currentSeq !== activeUploadSeqRef.current) return;
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      });

      xhr.addEventListener("load", () => {
        if (currentSeq !== activeUploadSeqRef.current) return;
        onUploadStateChange?.(sectionId, false);

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.success && data.asset?.url) {
              setUploadStatus("success");
              setUploadProgress(null);
              setLastFailedFile(null);
              setSuccessMessage(`Image "${file.name}" uploaded to storage. Click "Save page layouts" below to publish.`);
              onImageChange(sectionId, data.asset.url, data.asset);
            } else {
              setUploadStatus("error");
              setErrorMessage(data.error || "Upload processing failed on the server.");
            }
          } catch {
            setUploadStatus("error");
            setErrorMessage("Invalid server response during upload.");
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            setUploadStatus("error");
            setErrorMessage(data.error || `Upload failed with status ${xhr.status}.`);
          } catch {
            setUploadStatus("error");
            setErrorMessage(`Upload failed with status ${xhr.status}.`);
          }
        }
      });

      xhr.addEventListener("error", () => {
        if (currentSeq !== activeUploadSeqRef.current) return;
        onUploadStateChange?.(sectionId, false);
        setUploadStatus("error");
        setErrorMessage("Network error during file upload. Check your connection and retry.");
      });

      xhr.open("POST", "/api/admin/media/upload");
      xhr.send(formData);
    },
    [sectionId, imageAltEn, imageAltAr, onImageChange, onUploadStateChange]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleSelectAsset = (asset: SectionMediaAsset) => {
    onImageChange(sectionId, asset.url, asset);
    setIsLibraryOpen(false);
    setErrorMessage(null);
    setSuccessMessage(`Selected "${asset.filename}" from Media Library. Remember to save page layouts.`);
  };

  const handleRemove = () => {
    onImageChange(sectionId, "", undefined);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const filteredLibrary = existingAssets.filter((a) => {
    if (!libraryFilter.trim()) return true;
    const q = libraryFilter.toLowerCase();
    return a.filename.toLowerCase().includes(q) || a.url.toLowerCase().includes(q);
  });

  return (
    <div className="section-image-field-wrap">
      <div className="section-image-field-header">
        <label className="section-image-label">
          Section Image
        </label>
        <span className="section-image-badge">Image</span>
      </div>

      {/* Hidden File Input for Native File Selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = "";
        }}
      />

      {/* Upload Progress Bar */}
      {uploadStatus === "uploading" && (
        <div className="section-image-progress" role="progressbar" aria-valuenow={uploadProgress ?? 0} aria-valuemin={0} aria-valuemax={100}>
          <div className="section-image-progress-bar">
            <span>Uploading image to storage...</span>
            <strong>{uploadProgress !== null ? `${uploadProgress}%` : "Processing..."}</strong>
          </div>
          <div className="section-image-progress-track">
            <div
              className="section-image-progress-fill"
              style={{ width: `${uploadProgress ?? 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error State with Retry & Dismiss */}
      {errorMessage && (
        <div className="section-image-error" role="alert">
          <span className="section-image-error-text">{errorMessage}</span>
          <div className="section-image-error-actions">
            {lastFailedFile && (
              <button
                type="button"
                className="secondary section-image-retry-btn"
                onClick={() => uploadFile(lastFailedFile)}
              >
                Retry
              </button>
            )}
            <button
              type="button"
              className="section-image-dismiss-btn"
              onClick={() => {
                setErrorMessage(null);
                setUploadStatus("idle");
              }}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && !errorMessage && (
        <div className="section-image-success">
          <span>✓ {successMessage}</span>
        </div>
      )}

      {/* Main Authoring Area: Preview Card or Upload Dropzone */}
      {imageUrl ? (
        <div className="section-image-preview-card">
          <div className="section-image-preview-viewport">
            {!imgLoadError ? (
              <Image
                src={imageUrl}
                alt={imageAltEn || displayFilename || "Section image"}
                fill
                sizes="(max-width: 800px) 100vw, 540px"
                style={{ objectFit: "cover" }}
                onError={() => setImgLoadError(true)}
              />
            ) : (
              <div className="section-image-load-failed">
                <span aria-hidden="true" style={{ fontSize: "24px" }}>🖼️</span>
                <span>Image preview unavailable ({displayFilename})</span>
              </div>
            )}
          </div>

          {/* Image Information & Action Toolbar */}
          <div className="section-image-toolbar">
            <div className="section-image-meta">
              <strong className="section-image-filename" title={imageUrl}>
                {displayFilename}
              </strong>
              {(matchedAsset?.size || (matchedAsset?.width && matchedAsset?.height)) && (
                <span className="section-image-specs">
                  {matchedAsset.width && matchedAsset.height && `${matchedAsset.width} × ${matchedAsset.height} px`}
                  {matchedAsset.width && matchedAsset.size ? " · " : ""}
                  {formatBytes(matchedAsset.size)}
                </span>
              )}
            </div>

            <div className="section-image-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Replace image from local files"
              >
                Replace Image
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setIsLibraryOpen(true)}
                aria-label="Choose image from Media Library"
              >
                Media Library
              </button>
              <button
                type="button"
                className="danger"
                onClick={handleRemove}
                aria-label="Remove image from this section"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Drag-and-Drop Dropzone when no image is selected */
        <div
          className={`section-image-dropzone ${isDragging ? "is-dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload an image or choose from Media Library"
        >
          <div className="section-image-dropzone-icon" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <strong className="section-image-dropzone-title">
            Click to upload or drag &amp; drop an image
          </strong>
          <span className="section-image-dropzone-hint">
            JPEG, PNG, WebP, AVIF up to 12 MB
          </span>

          <div className="section-image-dropzone-btns" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Image
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setIsLibraryOpen(true)}
            >
              Choose from Media Library
            </button>
          </div>
        </div>
      )}

      {/* Bilingual Alt Text Inputs */}
      <div className="bilingual section-image-alt-row">
        <label>
          Image alt — English
          <input
            type="text"
            value={imageAltEn}
            placeholder="Describe image for screen readers and search..."
            onChange={(e) => onAltChange(sectionId, { imageAltEn: e.target.value })}
          />
        </label>
        <label>
          Image alt — العربية
          <input
            type="text"
            dir="rtl"
            value={imageAltAr}
            placeholder="وصف الصورة باللغة العربية لقارئات الشاشة..."
            onChange={(e) => onAltChange(sectionId, { imageAltAr: e.target.value })}
          />
        </label>
      </div>

      {/* Media Library Modal Dialog */}
      {isLibraryOpen && (
        <div
          className="section-library-modal-backdrop"
          onClick={() => setIsLibraryOpen(false)}
          role="presentation"
        >
          <div
            className="section-library-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Media Library"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-library-header">
              <div>
                <h3>Media Library</h3>
                <p className="hint">Select an existing image asset for this section.</p>
              </div>
              <button
                type="button"
                className="section-library-close-btn"
                onClick={() => setIsLibraryOpen(false)}
                aria-label="Close Media Library"
              >
                ✕
              </button>
            </div>

            <div className="section-library-search-wrap">
              <input
                type="search"
                className="section-library-search-input"
                placeholder="Search assets by filename or URL..."
                value={libraryFilter}
                onChange={(e) => setLibraryFilter(e.target.value)}
                autoFocus
              />
            </div>

            {filteredLibrary.length > 0 ? (
              <div className="section-library-grid">
                {filteredLibrary.map((asset) => {
                  const isSelected = asset.url === imageUrl;
                  return (
                    <button
                      key={asset.id || asset.url}
                      type="button"
                      className={`section-library-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleSelectAsset(asset)}
                    >
                      <div className="section-library-thumb">
                        <Image
                          src={asset.url}
                          alt={asset.altEn || asset.filename}
                          fill
                          sizes="180px"
                          style={{ objectFit: "cover" }}
                        />
                        {isSelected && <span className="section-library-selected-badge">Active</span>}
                      </div>
                      <div className="section-library-card-info">
                        <strong className="section-library-card-name" title={asset.filename}>
                          {asset.filename}
                        </strong>
                        <span className="section-library-card-meta">
                          {asset.width && asset.height ? `${asset.width}×${asset.height}` : ""}
                          {asset.width && asset.size ? " · " : ""}
                          {formatBytes(asset.size)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="section-library-empty">
                <p>No images matching &quot;{libraryFilter}&quot; found in the Media Library.</p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload New Image Instead
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

