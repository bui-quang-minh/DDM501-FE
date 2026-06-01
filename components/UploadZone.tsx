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

function dropzoneClass(status: string, dragging: boolean): string {
  const base =
    "flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-xl cursor-pointer transition-colors select-none";
  if (status === "error") return `${base} border-red-400 bg-red-50`;
  if (dragging) return `${base} border-blue-500 bg-blue-50`;
  return `${base} border-gray-300 bg-gray-50 hover:bg-gray-100`;
}

export default function UploadZone({ onFileReady, onFileRemoved }: Props) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        setState({ status: "error", message: "Only PDF files are accepted." });
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
          message: "Could not read the PDF. The file may be corrupted.",
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

  return (
    <div className="w-full space-y-4">
      {/* Drop zone — hidden once a valid file is loaded */}
      {state.status !== "valid" && (
        <label
          className={dropzoneClass(state.status, dragging)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
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
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
              e.target.value = "";
            }}
          />

          {state.status === "validating" ? (
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Checking PDF…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-500 pointer-events-none">
              <PdfIcon />
              <span className="font-medium text-gray-700">
                {dragging ? "Thả file vào đây" : "Kéo thả hồ sơ mời thầu vào đây"}
              </span>
              <span className="text-xs text-gray-400">hoặc nhấn để chọn file</span>
              <span className="mt-2 text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                Chỉ nhận PDF · Dạng văn bản (không phải scan)
              </span>
            </div>
          )}
        </label>
      )}

      {/* Error banner */}
      {state.status === "error" && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <ErrorIcon />
          <span>{state.message}</span>
        </div>
      )}

      {/* Valid state: file bar + inline preview */}
      {state.status === "valid" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2 text-green-700 min-w-0">
              <CheckIcon />
              <span className="font-medium text-sm truncate">{state.file.name}</span>
              <span className="text-xs text-green-500 shrink-0">
                ({state.pageCount} {state.pageCount === 1 ? "page" : "pages"})
              </span>
            </div>
            <button
              onClick={reset}
              className="ml-4 text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0"
            >
              Remove
            </button>
          </div>

          <div
            className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm"
            style={{ height: "68vh" }}
          >
            <iframe
              src={state.previewUrl}
              className="w-full h-full"
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PdfIcon() {
  return (
    <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
