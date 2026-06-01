"use client";

import { useState } from "react";
import UploadZone from "@/components/UploadZone";
import { extractPdfText } from "@/lib/pdf-validator";

type ProcessState = "idle" | "extracting" | "done" | "error";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [processState, setProcessState] = useState<ProcessState>("idle");
  const [extractedText, setExtractedText] = useState<string>("");

  async function handleProcess() {
    if (!file) return;
    setProcessState("extracting");
    try {
      const text = await extractPdfText(file);
      setExtractedText(text);
      setProcessState("done");
    } catch {
      setProcessState("error");
    }
  }

  function handleFileRemoved() {
    setFile(null);
    setProcessState("idle");
    setExtractedText("");
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">DDM501</h1>
          <p className="text-sm text-gray-500"></p>
        </header>

        <UploadZone
          onFileReady={(f) => setFile(f)}
          onFileRemoved={handleFileRemoved}
        />

        {file && (
          <div className="flex justify-end">
            <button
              onClick={handleProcess}
              disabled={processState === "extracting"}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {processState === "extracting" && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {processState === "extracting" ? "Đang xử lý…" : "Xử lý tài liệu →"}
            </button>
          </div>
        )}

        {processState === "done" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                Nội dung văn bản trích xuất
              </h2>
              <span className="text-xs text-gray-400">
                {extractedText.length.toLocaleString()} ký tự
              </span>
            </div>
            <pre className="w-full h-96 overflow-auto rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
              {extractedText}
            </pre>
          </div>
        )}

        {processState === "error" && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            Không thể trích xuất nội dung. Vui lòng thử lại.
          </p>
        )}
      </div>
    </main>
  );
}
