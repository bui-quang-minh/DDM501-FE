"use client";

import { useCallback, useRef, useState } from "react";
import { validatePdfIsReadable } from "@/lib/pdf-validator";

type UploadState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "valid"; file: File; pageCount: number; previewUrl: string }
  | { status: "error"; message: string };

interface Props {
  onFileReady: (file: File) => void;
  onFileRemoved: () => void;
}

export default function UploadZone({ onFileReady, onFileRemoved }: Props) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        setState({ status: "error", message: "Chỉ nhận file PDF dạng văn bản." });
        return;
      }

      setState({ status: "validating" });

      try {
        const result = await validatePdfIsReadable(file);
        if (!result.valid) {
          setState({ status: "error", message: result.reason! });
          return;
        }
        const previewUrl = URL.createObjectURL(file);
        setState({ status: "valid", file, pageCount: result.pageCount, previewUrl });
        onFileReady(file);
      } catch {
        setState({
          status: "error",
          message: "Lỗi không đọc được PDF, file có thể bị hỏng.",
        });
      }
    },
    [onFileReady]
  );

  const reset = useCallback(() => {
    if (state.status === "valid") URL.revokeObjectURL(state.previewUrl);
    setState({ status: "idle" });
    onFileRemoved();
  }, [state, onFileRemoved]);

  const dropzoneStyle = {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: "200px",
    border: "2px dashed",
    borderColor: state.status === "error" ? "#fca5a5" : dragging ? "var(--color-primary)" : "#cbd5e1",
    borderRadius: "12px",
    background: state.status === "error" ? "#fef2f2" : dragging ? "#eff6ff" : "#f8fafc",
    cursor: "pointer",
    transition: "all 0.2s",
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Drop zone — hidden once a valid file is loaded */}
      {state.status !== "valid" && (
        <label
          style={dropzoneStyle}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) processFile(file);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
              e.target.value = "";
            }}
          />

          {state.status === "validating" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--color-text-muted)" }}>
              <div className="spinner" style={{ width: 32, height: 32 }} />
              <span style={{ fontSize: 14 }}>Đang kiểm tra PDF...</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--color-text-muted)", pointerEvents: "none" }}>
              <PdfIcon />
              <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 15 }}>
                {dragging ? "Thả file vào đây" : "Kéo thả hồ sơ hoặc chứng chỉ vào đây"}
              </span>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>hoặc nhấn để chọn file</span>
              <span style={{ marginTop: 8, fontSize: 12, background: "white", padding: "4px 12px", borderRadius: 999, border: "1px solid var(--color-border)" }}>
                Chỉ nhận PDF · Dạng văn bản (không phải scan)
              </span>
            </div>
          )}
        </label>
      )}

      {/* Error banner */}
      {state.status === "error" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px" }}>
          <ErrorIcon />
          <span>{state.message}</span>
        </div>
      )}

      {/* Valid state: file bar + inline preview */}
      {state.status === "valid" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "10px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#047857" }}>
              <CheckIcon />
              <span style={{ fontWeight: 500, fontSize: 14 }}>{state.file.name}</span>
              <span style={{ fontSize: 12, color: "#10b981" }}>({state.pageCount} trang)</span>
            </div>
            <button
              type="button"
              onClick={reset}
              style={{ fontSize: 12, color: "var(--color-text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
            >
              Xóa file
            </button>
          </div>

          <div style={{ width: "100%", height: "60vh", borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-sm)" }}>
            <iframe src={state.previewUrl} style={{ width: "100%", height: "100%", border: "none" }} title="PDF Preview" />
          </div>
        </div>
      )}
    </div>
  );
}

function PdfIcon() {
  return (
    <svg style={{ width: 40, height: 40, color: "#cbd5e1" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg style={{ width: 16, height: 16, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg style={{ width: 16, height: 16, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
