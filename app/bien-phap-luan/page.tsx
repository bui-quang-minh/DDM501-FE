"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validatePdfIsReadable, extractPdfText } from "@/lib/pdf-validator";
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel,
} from "docx";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Requirement = {
  query: string;
  count: number;
  min_years_experience: number | null;
  must_have_certificates: string[];
};

type SearchResult = {
  score: number;
  employee_id: string;
  name: string;
  position: string | null;
  department: string | null;
  years_of_experience: number | null;
  valid_certificates: string[];
};

type ReqState = {
  loading: boolean;
  results: SearchResult[];
  error: string | null;
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

const AVATAR_COLORS = ["#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626"];
const getColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) => name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();
const scoreColor = (s: number) => s >= 0.8 ? "#059669" : s >= 0.6 ? "#d97706" : "#6b7280";

export default function BienPhapLuanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [reqStates, setReqStates] = useState<ReqState[]>([]);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Auto-search each requirement when done
  useEffect(() => {
    if (stage.step !== "done" || stage.requirements.length === 0) return;
    const reqs = stage.requirements;
    setReqStates(reqs.map(() => ({ loading: true, results: [], error: null })));

    reqs.forEach(async (req, i) => {
      try {
        const body: Record<string, any> = {
          query: req.query,
          top_k: req.count > 0 ? req.count : 5,
        };
        if (req.min_years_experience != null) body.min_years_experience = req.min_years_experience;
        if (req.must_have_certificates.length > 0) body.must_have_certificates = req.must_have_certificates;

        const res = await fetch(`${BASE_URL}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setReqStates(prev => {
          const next = [...prev];
          next[i] = { loading: false, results: data.results ?? [], error: null };
          return next;
        });
      } catch (err) {
        setReqStates(prev => {
          const next = [...prev];
          next[i] = { loading: false, results: [], error: err instanceof Error ? err.message : "Lỗi tìm kiếm" };
          return next;
        });
      }
    });
  }, [stage]);

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") {
      setStage({ step: "error", message: "Chỉ chấp nhận file PDF dạng văn bản." });
      return;
    }
    setFile(f);
    setReqStates([]);
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
      setStage({ step: "error", message: err instanceof Error ? err.message : "Có lỗi xảy ra. Vui lòng thử lại." });
    }
  }, []);

  const reset = () => {
    setFile(null);
    setReqStates([]);
    setStage({ step: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const copyJson = async (requirements: Requirement[]) => {
    await navigator.clipboard.writeText(JSON.stringify(requirements, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadWord = async (requirements: Requirement[], states: ReqState[]) => {
    const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
    const cellBorders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

    const headerCell = (text: string) => new TableCell({
      borders: cellBorders,
      shading: { fill: "1E40AF" },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 22 })],
      })],
    });

    const dataCell = (text: string, center = false) => new TableCell({
      borders: cellBorders,
      children: [new Paragraph({
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text, size: 22 })],
      })],
    });

    const rows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell("STT"),
          headerCell("Họ và tên"),
          headerCell("Trình độ chuyên môn"),
          headerCell("Công việc đảm nhận"),
        ],
      }),
    ];

    let stt = 1;
    requirements.forEach((req, i) => {
      const results = states[i]?.results ?? [];
      results.forEach(emp => {
        rows.push(new TableRow({
          children: [
            dataCell(String(stt++), true),
            dataCell(emp.name ?? ""),
            dataCell(emp.valid_certificates?.join(", ") || emp.position || ""),
            dataCell(req.query),
          ],
        }));
      });
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "DANH SÁCH NHÂN SỰ ĐỀ XUẤT", bold: true, size: 28 })],
          }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name.replace(".pdf", "") ?? "ket_qua") + "_nhan_su_de_xuat.docx";
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
        .spinner-sm {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid #e2e8f0; border-top-color: var(--color-primary);
          animation: spin 0.8s linear infinite; display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500;
          background: white; color: var(--color-text-muted); border: 1px solid var(--color-border);
        }
        .req-card {
          border: 1px solid var(--color-border); border-radius: 12px;
          background: var(--color-bg-card); overflow: hidden;
        }
        .req-header {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 20px; border-bottom: 1px solid var(--color-border);
          background: #f8fafc;
        }
        .emp-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 20px; border-bottom: 1px solid var(--color-border);
        }
        .emp-row:last-child { border-bottom: none; }
      `}</style>

      <div className="topbar">
        <div>
          <div className="topbar-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 24, height: 24, color: "var(--color-primary)" }}>{Icons.robot}</span>
            Biện pháp luận — Phân tích Hồ sơ
          </div>
          <div className="topbar-subtitle">Upload PDF hồ sơ mời thầu để trích xuất và ghép nhân sự tự động</div>
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
                  Upload file PDF hồ sơ mời thầu. AI sẽ trích xuất danh sách vị trí cần thiết, số lượng người,
                  kinh nghiệm và chứng chỉ — sau đó tự động tìm nhân sự phù hợp trong hệ thống.
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.document}</span> PDF dạng văn bản</span>
                  <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.robot}</span> Phân tích tự động</span>
                  <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.users}</span> Ghép nhân sự AI</span>
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
                { icon: Icons.robot, step: "3", title: "Phân tích AI", desc: "AI xác định vị trí, số lượng, chứng chỉ" },
                { icon: Icons.users, step: "4", title: "Ghép nhân sự", desc: "Tự động tìm ứng viên phù hợp nhất" },
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
            {/* Banner */}
            <div style={{
              background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 28, height: 28, color: "#059669" }}>{Icons.check}</span>
                <div>
                  <div style={{ fontWeight: 600, color: "#065f46" }}>
                    Tìm thấy {stage.requirements.length} vị trí ·{" "}
                    {stage.requirements.reduce((s, r) => s + (r.count || 1), 0)} người cần
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
                {reqStates.length > 0 && reqStates.every(rs => !rs.loading) && (
                  <button className="btn btn-primary" onClick={() => downloadWord(stage.requirements, reqStates)}>
                    <span style={{ width: 16, height: 16 }}>{Icons.download}</span> Tải về Word
                  </button>
                )}
              </div>
            </div>

            {/* Requirement cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {stage.requirements.map((req, i) => {
                const rs = reqStates[i];
                const needed = req.count > 0 ? req.count : 1;
                const found = rs?.results.length ?? 0;

                return (
                  <div key={i} className="req-card">
                    {/* Requirement header */}
                    <div className="req-header">
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: "var(--color-primary)", color: "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, flexShrink: 0,
                      }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text)" }}>{req.query}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          <span style={{
                            fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 6,
                            background: "#e0e7ff", color: "#4338ca",
                          }}>
                            Cần {needed} người
                          </span>
                          {req.min_years_experience != null && (
                            <span style={{ fontSize: 12, background: "#eff6ff", color: "#2563eb", padding: "2px 10px", borderRadius: 6 }}>
                              ≥ {req.min_years_experience} năm KN
                            </span>
                          )}
                          {req.must_have_certificates.map(cert => (
                            <span key={cert} style={{ fontSize: 12, background: "#ecfdf5", color: "#059669", padding: "2px 10px", borderRadius: 6 }}>
                              {cert}
                            </span>
                          ))}
                        </div>
                      </div>
                      {rs && !rs.loading && (
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: found >= needed ? "#059669" : "#d97706" }}>
                            {found}/{needed}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>tìm được</div>
                        </div>
                      )}
                    </div>

                    {/* Search results */}
                    {!rs || rs.loading ? (
                      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 10, color: "var(--color-text-muted)", fontSize: 14 }}>
                        <div className="spinner-sm" /> Đang tìm kiếm nhân sự phù hợp...
                      </div>
                    ) : rs.error ? (
                      <div style={{ padding: "12px 20px", fontSize: 13, color: "#b91c1c" }}>
                        Lỗi tìm kiếm: {rs.error}
                      </div>
                    ) : rs.results.length === 0 ? (
                      <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--color-text-muted)" }}>
                        Không tìm thấy nhân sự phù hợp trong hệ thống
                      </div>
                    ) : (
                      rs.results.map((emp, j) => (
                        <div key={emp.employee_id ?? j} className="emp-row">
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", width: 20, textAlign: "center", flexShrink: 0 }}>
                            {j + 1}
                          </div>
                          <div className="avatar" style={{ background: getColor(emp.name ?? "?"), flexShrink: 0, width: 32, height: 32, fontSize: 12 }}>
                            {getInitials(emp.name ?? "?")}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>{emp.name}</div>
                            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                              {emp.position || "—"}
                              {emp.department ? ` · ${emp.department}` : ""}
                              {emp.years_of_experience != null ? ` · ${emp.years_of_experience} năm KN` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", maxWidth: 280 }}>
                            {emp.valid_certificates?.slice(0, 2).map(c => (
                              <span key={c} style={{ fontSize: 11, background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: 6 }}>{c}</span>
                            ))}
                            {(emp.valid_certificates?.length ?? 0) > 2 && (
                              <span style={{ fontSize: 11, background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 6 }}>
                                +{emp.valid_certificates.length - 2}
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, flexShrink: 0,
                            background: `${scoreColor(emp.score)}18`, color: scoreColor(emp.score),
                          }}>
                            {(emp.score * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>

            {/* Raw JSON */}
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
