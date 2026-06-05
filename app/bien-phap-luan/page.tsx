"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validatePdfIsReadable, extractPdfText } from "@/lib/pdf-validator";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Stage =
  | { step: "idle" }
  | { step: "validating" }
  | { step: "extracting" }
  | { step: "sending" }
  | { step: "done"; markdown: string; pageCount: number; chars: number }
  | { step: "error"; message: string };

function parseMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="md-li">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="md-ul">$1</ul>')
    .replace(/\n{2,}/g, '</p><p class="md-p">')
    .replace(/^(?!<[hul])(.+)$/gm, '<p class="md-p">$1</p>')
    .replace(/<p class="md-p"><\/p>/g, "");
}

const Icons = {
  upload: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  cog: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  robot: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h0m6 0h0m-6 4h6" /></svg>,
  document: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  refresh: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  check: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  copy: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  download: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  warning: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
};

export default function BienPhapLuanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [markdown, setMarkdown] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") {
      setStage({ step: "error", message: "Chỉ chấp nhận file PDF dạng văn bản." });
      return;
    }
    setFile(f);
    setMarkdown("");
    setStage({ step: "validating" });

    try {
      // Step 1: Validate
      const validation = await validatePdfIsReadable(f);
      if (!validation.valid) {
        setStage({ step: "error", message: validation.reason ?? "PDF không hợp lệ." });
        return;
      }

      // Step 2: Extract text
      setStage({ step: "extracting" });
      const text = await extractPdfText(f);

      // Step 3: Send to AI
      setStage({ step: "sending" });
      const res = await fetch(`${BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error(`Lỗi API: ${res.status}`);
      const data = await res.json();
      const result = data.markdown ?? data.result ?? data.content ?? JSON.stringify(data);
      setMarkdown(result);
      setStage({ step: "done", markdown: result, pageCount: validation.pageCount, chars: text.length });

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Có lỗi xảy ra. Vui lòng thử lại.";
      setStage({ step: "error", message: msg });
    }
  }, []);

  const reset = () => {
    setFile(null);
    setMarkdown("");
    setStage({ step: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name.replace(".pdf", "") ?? "ket_qua") + "_bien_phap_luan.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const isProcessing = ["validating", "extracting", "sending"].includes(stage.step);

  const stageLabel: Record<string, string> = {
    validating: "Đang kiểm tra PDF...",
    extracting: "Đang trích xuất nội dung...",
    sending: "Hệ thống đang phân tích hồ sơ...",
  };

  return (
    <>
      <style>{`
        .md-h1 { font-size: 20px; font-weight: 700; color: var(--color-text); margin: 24px 0 12px; }
        .md-h2 { font-size: 16px; font-weight: 600; color: var(--color-primary); margin: 20px 0 8px; border-bottom: 1px solid var(--color-border); padding-bottom: 6px; }
        .md-h3 { font-size: 14px; font-weight: 600; color: var(--color-text); margin: 16px 0 6px; }
        .md-p { color: var(--color-text-muted); line-height: 1.6; margin: 8px 0; font-size: 14px; }
        .md-ul { padding-left: 24px; margin: 8px 0; }
        .md-li { color: var(--color-text-muted); line-height: 1.6; font-size: 14px; list-style-type: disc; margin: 4px 0; }
        .upload-zone {
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          background: #f8fafc;
          transition: all 0.2s ease;
          cursor: pointer;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 240px; gap: 16px; text-align: center;
          padding: 40px;
        }
        .upload-zone.dragging {
          border-color: var(--color-primary);
          background: #eff6ff;
        }
        .upload-zone:hover {
          border-color: #94a3b8;
          background: white;
          box-shadow: var(--shadow-sm);
        }
        .pulse-ring {
          width: 64px; height: 64px; border-radius: 50%;
          background: #e0e7ff; color: var(--color-primary);
          display: flex; align-items: center; justify-content: center;
        }
        .pulse-ring svg { width: 32px; height: 32px; }
        .progress-steps { display: flex; align-items: center; gap: 12px; }
        .step-dot {
          width: 12px; height: 12px; border-radius: 50%;
          background: #e2e8f0;
          transition: all 0.3s;
        }
        .step-dot.active { background: var(--color-primary); box-shadow: 0 0 0 4px #dbeafe; }
        .step-dot.done { background: #10b981; }
        .spinner {
          width: 40px; height: 40px; border-radius: 50%;
          border: 3px solid #e2e8f0;
          border-top-color: var(--color-primary);
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .result-box {
          background: #f8fafc;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 32px;
          max-height: 600px;
          overflow-y: auto;
          font-family: 'Inter', sans-serif;
        }
        .chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px;
          border-radius: 999px; font-size: 12px; font-weight: 500;
          background: white; color: var(--color-text-muted);
          border: 1px solid var(--color-border);
        }
        .chip svg { width: 14px; height: 14px; }
      `}</style>

      {/* Topbar */}
      <div className="topbar">
        <div>
          <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 24, height: 24, color: 'var(--color-primary)' }}>{Icons.robot}</span> 
            Biện pháp luận — Phân tích Hồ sơ
          </div>
          <div className="topbar-subtitle">Upload PDF hồ sơ mời thầu để tự động tạo Biện pháp luận</div>
        </div>
        {(stage.step === "done" || file) && (
          <button className="btn btn-ghost" onClick={reset}>
            <span style={{ width: 16, height: 16 }}>{Icons.refresh}</span> Làm lại
          </button>
        )}
      </div>

      <div className="page-content" style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* ─── IDLE / UPLOAD STAGE ─── */}
        {!file && stage.step === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Hero banner */}
            <div style={{
              background: "white",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-sm)",
              borderRadius: 16, padding: "28px 32px",
              display: "flex", gap: 24, alignItems: "center"
            }}>
              <div style={{ width: 48, height: 48, color: "var(--color-primary)", flexShrink: 0 }}>
                {Icons.document}
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
                  Tạo Biện pháp luận từ Hồ sơ mời thầu
                </h2>
                <p style={{ color: "var(--color-text-muted)", lineHeight: 1.6, fontSize: 14 }}>
                  Upload file PDF hồ sơ mời thầu (dạng văn bản). Hệ thống sẽ tự động trích xuất nội dung,
                  phân tích và sinh ra Biện pháp luận hoàn chỉnh dưới dạng Markdown — sẵn sàng để chỉnh sửa và xuất báo cáo.
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.document}</span> PDF dạng văn bản</span>
                  <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.robot}</span> Phân tích tự động</span>
                  <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.copy}</span> Dạng Markdown</span>
                </div>
              </div>
            </div>

            {/* Upload zone */}
            <label
              className={`upload-zone ${dragging ? "dragging" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault(); setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="pulse-ring">{Icons.upload}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)" }}>
                  {dragging ? "Thả file vào đây" : "Kéo thả hồ sơ mời thầu"}
                </div>
                <div style={{ color: "var(--color-text-muted)", fontSize: 14, marginTop: 6 }}>
                  hoặc <span style={{ color: "var(--color-primary)", fontWeight: 500 }}>nhấn để chọn file</span>
                </div>
              </div>
            </label>

            {/* Step guide */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16
            }}>
              {[
                { icon: Icons.upload, step: "1", title: "Upload PDF", desc: "Chọn file hồ sơ mời thầu dạng text" },
                { icon: Icons.cog, step: "2", title: "Trích xuất", desc: "Hệ thống đọc và tách nội dung PDF" },
                { icon: Icons.robot, step: "3", title: "Phân tích", desc: "Hệ thống xử lý và sinh Biện pháp luận" },
                { icon: Icons.document, step: "4", title: "Nhận kết quả", desc: "Xem, sao chép hoặc tải về Markdown" },
              ].map(s => (
                <div key={s.step} className="stat-card" style={{ flexDirection: "column", gap: 12, padding: 20, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: "#f1f5f9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)"
                    }}>{s.step}</div>
                    <span style={{ width: 20, height: 20, color: "var(--color-primary)" }}>{s.icon}</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── ERROR STATE ─── */}
        {stage.step === "error" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 12, padding: 24, display: "flex", gap: 16, alignItems: "flex-start"
            }}>
              <span style={{ width: 24, height: 24, color: "#dc2626" }}>{Icons.warning}</span>
              <div>
                <div style={{ fontWeight: 600, color: "#991b1b", marginBottom: 6 }}>Đã xảy ra lỗi</div>
                <div style={{ color: "#b91c1c", fontSize: 14 }}>{stage.message}</div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={reset} style={{ alignSelf: "flex-start" }}>
              <span style={{ width: 16, height: 16 }}>{Icons.refresh}</span> Thử lại
            </button>
          </div>
        )}

        {/* ─── PROCESSING STAGE ─── */}
        {isProcessing && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 24, padding: "60px 20px", textAlign: "center",
            background: "white", borderRadius: 16, border: "1px solid var(--color-border)", boxShadow: "var(--shadow-sm)"
          }}>
            <div className="spinner" />

            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)", marginBottom: 8 }}>
                {stageLabel[stage.step]}
              </div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
                {file?.name} · Vui lòng chờ...
              </div>
            </div>

            {/* Step progress dots */}
            <div className="progress-steps">
              {(["validating", "extracting", "sending"] as const).map((s, i) => {
                const steps = ["validating", "extracting", "sending"];
                const current = steps.indexOf(stage.step);
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className={`step-dot ${i < current ? "done" : i === current ? "active" : ""}`} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: i <= current ? "var(--color-text)" : "var(--color-text-muted)" }}>
                      {["Kiểm tra", "Trích xuất", "Xử lý"][i]}
                    </span>
                    {i < 2 && <div style={{ width: 32, height: 2, background: i < current ? "#10b981" : "#e2e8f0" }} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── DONE STAGE ─── */}
        {stage.step === "done" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Result header */}
            <div style={{
              background: "#ecfdf5", border: "1px solid #a7f3d0",
              borderRadius: 12, padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 28, height: 28, color: "#059669" }}>{Icons.check}</span>
                <div>
                  <div style={{ fontWeight: 600, color: "#065f46" }}>Hệ thống đã hoàn tất phân tích</div>
                  <div style={{ color: "#047857", fontSize: 13, marginTop: 2 }}>
                    {stage.pageCount} trang · {stage.chars.toLocaleString()} ký tự trích xuất
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" onClick={copyToClipboard} style={{ background: "white" }}>
                  <span style={{ width: 16, height: 16 }}>{copied ? Icons.check : Icons.copy}</span>
                  {copied ? "Đã sao chép" : "Copy Markdown"}
                </button>
                <button className="btn btn-primary" onClick={downloadMarkdown}>
                  <span style={{ width: 16, height: 16 }}>{Icons.download}</span> Tải về .md
                </button>
              </div>
            </div>

            {/* Markdown result */}
            <div ref={resultRef} className="card">
              <div className="card-header">
                <span className="card-title">Kết quả Biện pháp luận</span>
                <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{file?.name}</span>
              </div>
              <div className="card-body">
                <div
                  className="result-box"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(markdown) }}
                />
              </div>
            </div>

            {/* Raw markdown toggle */}
            <details style={{ cursor: "pointer", background: "white", padding: 16, borderRadius: 12, border: "1px solid var(--color-border)" }}>
              <summary style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 500 }}>
                Xem Markdown thô
              </summary>
              <pre style={{
                marginTop: 16, background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 8, padding: 20, fontSize: 13, color: "var(--color-text)",
                overflowX: "auto", whiteSpace: "pre-wrap", lineHeight: 1.6
              }}>
                {markdown}
              </pre>
            </details>
          </div>
        )}

      </div>
    </>
  );
}
