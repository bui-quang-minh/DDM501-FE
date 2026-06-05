"use client";

import { useCallback, useRef, useState } from "react";
import { validatePdfIsReadable, extractPdfText } from "@/lib/pdf-validator";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Requirement = {
  query: string;
  min_years_experience: number | null;
  must_have_certificates: string[];
};

type Stage =
  | { step: "idle" }
  | { step: "validating" }
  | { step: "extracting" }
  | { step: "sending" }
  | { step: "done"; requirements: Requirement[]; pageCount: number; chars: number }
  | { step: "error"; message: string };

const Icons = {
  upload: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  cog: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  robot: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h0m6 0h0m-6 4h6" /></svg>,
  document: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  refresh: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  check: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  copy: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  download: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  warning: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  users: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
};

export default function BienPhapLuanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") {
      setStage({ step: "error", message: "Chỉ chấp nhận file PDF dạng văn bản." });
      return;
    }
    setFile(f);
    setStage({ step: "validating" });

    try {
      const validation = await validatePdfIsReadable(f);
      if (!validation.valid) {
        setStage({ step: "error", message: validation.reason ?? "PDF không hợp lệ." });
        return;
      }

      setStage({ step: "extracting" });
      const text = await extractPdfText(f);

      setStage({ step: "sending" });
      const res = await fetch(`${BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error(`Lỗi API: ${res.status}`);
      const data = await res.json();

      const raw = data.result ?? data.markdown ?? data.content ?? data;
      const requirements: Requirement[] = Array.isArray(raw) ? raw : [];

      setStage({ step: "done", requirements, pageCount: validation.pageCount, chars: text.length });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Có lỗi xảy ra. Vui lòng thử lại.";
      setStage({ step: "error", message: msg });
    }
  }, []);

  const reset = () => {
    setFile(null);
    setStage({ step: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const copyJson = async (requirements: Requirement[]) => {
    await navigator.clipboard.writeText(JSON.stringify(requirements, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = (requirements: Requirement[]) => {
    const blob = new Blob([JSON.stringify(requirements, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name.replace(".pdf", "") ?? "ket_qua") + "_yeu_cau_nhan_su.json";
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
        .upload-zone {
          border: 2px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;
          transition: all 0.2s ease; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 240px; gap: 16px; text-align: center; padding: 40px;
        }
        .upload-zone.dragging { border-color: var(--color-primary); background: #eff6ff; }
        .upload-zone:hover { border-color: #94a3b8; background: white; box-shadow: var(--shadow-sm); }
        .pulse-ring {
          width: 64px; height: 64px; border-radius: 50%;
          background: #e0e7ff; color: var(--color-primary);
          display: flex; align-items: center; justify-content: center;
        }
        .pulse-ring svg { width: 32px; height: 32px; }
        .spinner {
          width: 40px; height: 40px; border-radius: 50%;
          border: 3px solid #e2e8f0; border-top-color: var(--color-primary);
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500;
          background: white; color: var(--color-text-muted); border: 1px solid var(--color-border);
        }
        .chip svg { width: 14px; height: 14px; }
        .req-card {
          border: 1px solid var(--color-border); border-radius: 10px;
          padding: 16px 20px; background: var(--color-bg-card);
          display: flex; flex-direction: column; gap: 10px;
        }
      `}</style>

      <div className="topbar">
        <div>
          <div className="topbar-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 24, height: 24, color: "var(--color-primary)" }}>{Icons.robot}</span>
            Biện pháp luận — Phân tích Hồ sơ
          </div>
          <div className="topbar-subtitle">Upload PDF hồ sơ mời thầu để trích xuất yêu cầu nhân sự</div>
        </div>
        {(stage.step === "done" || file) && (
          <button className="btn btn-ghost" onClick={reset}>
            <span style={{ width: 16, height: 16 }}>{Icons.refresh}</span> Làm lại
          </button>
        )}
      </div>

      <div className="page-content" style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* IDLE */}
        {!file && stage.step === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{
              background: "white", border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-sm)", borderRadius: 16, padding: "28px 32px",
              display: "flex", gap: 24, alignItems: "center"
            }}>
              <div style={{ width: 48, height: 48, color: "var(--color-primary)", flexShrink: 0 }}>{Icons.document}</div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
                  Trích xuất yêu cầu nhân sự từ Hồ sơ mời thầu
                </h2>
                <p style={{ color: "var(--color-text-muted)", lineHeight: 1.6, fontSize: 14 }}>
                  Upload file PDF hồ sơ mời thầu. Hệ thống AI sẽ tự động phân tích và trích xuất danh sách
                  nhân sự yêu cầu kèm kinh nghiệm và chứng chỉ bắt buộc.
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.document}</span> PDF dạng văn bản</span>
                  <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.robot}</span> Phân tích tự động</span>
                  <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.users}</span> Danh sách nhân sự</span>
                </div>
              </div>
            </div>

            <label
              className={`upload-zone ${dragging ? "dragging" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              {[
                { icon: Icons.upload, step: "1", title: "Upload PDF", desc: "Chọn file hồ sơ mời thầu dạng text" },
                { icon: Icons.cog, step: "2", title: "Trích xuất", desc: "Hệ thống đọc và tách nội dung PDF" },
                { icon: Icons.robot, step: "3", title: "Phân tích AI", desc: "AI xác định vị trí, kinh nghiệm, chứng chỉ" },
                { icon: Icons.users, step: "4", title: "Nhận kết quả", desc: "Danh sách yêu cầu nhân sự sẵn sàng" },
              ].map(s => (
                <div key={s.step} className="stat-card" style={{ flexDirection: "column", gap: 12, padding: 20, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, background: "#f1f5f9",
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

        {/* ERROR */}
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

        {/* PROCESSING */}
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
              <div style={{ color: "var(--color-text-muted)", fontSize: 14 }}>{file?.name} · Vui lòng chờ...</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(["validating", "extracting", "sending"] as const).map((s, i) => {
                const current = ["validating", "extracting", "sending"].indexOf(stage.step);
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: "50%",
                      background: i < current ? "#10b981" : i === current ? "var(--color-primary)" : "#e2e8f0",
                      boxShadow: i === current ? "0 0 0 4px #dbeafe" : undefined,
                      transition: "all 0.3s",
                    }} />
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

        {/* DONE */}
        {stage.step === "done" && (
          <div ref={resultRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Success banner */}
            <div style={{
              background: "#ecfdf5", border: "1px solid #a7f3d0",
              borderRadius: 12, padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 28, height: 28, color: "#059669" }}>{Icons.check}</span>
                <div>
                  <div style={{ fontWeight: 600, color: "#065f46" }}>
                    Tìm thấy {stage.requirements.length} vị trí nhân sự
                  </div>
                  <div style={{ color: "#047857", fontSize: 13, marginTop: 2 }}>
                    {stage.pageCount} trang · {stage.chars.toLocaleString()} ký tự trích xuất
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => copyJson(stage.requirements)} style={{ background: "white" }}>
                  <span style={{ width: 16, height: 16 }}>{copied ? Icons.check : Icons.copy}</span>
                  {copied ? "Đã sao chép" : "Copy JSON"}
                </button>
                <button className="btn btn-primary" onClick={() => downloadJson(stage.requirements)}>
                  <span style={{ width: 16, height: 16 }}>{Icons.download}</span> Tải về .json
                </button>
              </div>
            </div>

            {/* Requirements list */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Danh sách yêu cầu nhân sự</span>
                <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{file?.name}</span>
              </div>
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                {stage.requirements.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
                    Không trích xuất được yêu cầu nhân sự nào
                  </div>
                ) : stage.requirements.map((req, i) => (
                  <div key={i} className="req-card">
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: "var(--color-primary)", color: "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>{i + 1}</div>
                      <span style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text)" }}>{req.query}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 40 }}>
                      {req.min_years_experience != null && (
                        <span style={{ fontSize: 12, background: "#eff6ff", color: "#2563eb", padding: "3px 10px", borderRadius: 6, fontWeight: 500 }}>
                          Tối thiểu {req.min_years_experience} năm KN
                        </span>
                      )}
                      {req.must_have_certificates.map(cert => (
                        <span key={cert} style={{ fontSize: 12, background: "#ecfdf5", color: "#059669", padding: "3px 10px", borderRadius: 6, fontWeight: 500 }}>
                          {cert}
                        </span>
                      ))}
                      {req.min_years_experience == null && req.must_have_certificates.length === 0 && (
                        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Không có yêu cầu cụ thể</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw JSON toggle */}
            <details style={{ cursor: "pointer", background: "white", padding: 16, borderRadius: 12, border: "1px solid var(--color-border)" }}>
              <summary style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 500 }}>Xem JSON thô</summary>
              <pre style={{
                marginTop: 16, background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 8, padding: 20, fontSize: 13, color: "var(--color-text)",
                overflowX: "auto", whiteSpace: "pre-wrap", lineHeight: 1.6
              }}>
                {JSON.stringify(stage.requirements, null, 2)}
              </pre>
            </details>
          </div>
        )}

      </div>
    </>
  );
}
