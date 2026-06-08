"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validatePdfIsReadable, extractPdfText } from "@/lib/pdf-validator";
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel,
  ShadingType, convertInchesToTwip,
} from "docx";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ─────────────────────────────────────────────────────────────────
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

type ProjectInfo = {
  tenDuAn: string;
  soQuyetDinh: string;
  mucTieuDauTu: string[];
  quyMoDauTu: string;
  diaDiemXayDung: string;
  loaiDuAn: string;
  nhomDuAn: string;
  capCongTrinh: string;
  soBuocThietKe: string;
  thoiGianThucHien: string;
  nguonVon: string;
  hinhThucQuanLy: string;
  thoiGianGoiThau: string;
  thoiGianGiamSat: string;
  thoiGianThanhQuyet: string;
};

type QuyMoGoiThau = {
  stt: number;
  moTaCongViec: string;
  donViTinh: string;
  khoiLuong: number | string;
};

type Stage =
  | { step: "idle" }
  | { step: "validating" }
  | { step: "extracting" }
  | { step: "sending" }
  | { step: "done"; requirements: Requirement[]; pageCount: number; chars: number }
  | { step: "error"; message: string };

type PreviewTab = "info" | "scope" | "personnel";

// ─── Icons ──────────────────────────────────────────────────────────────────
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
  eye: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  table: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M6 3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3z" /></svg>,
  info: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  edit: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
};

const AVATAR_COLORS = ["#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626"];
const getColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) => name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();
const scoreColor = (s: number) => s >= 0.8 ? "#059669" : s >= 0.6 ? "#d97706" : "#6b7280";

// ─── Bảng map Tỉnh/Thành → Mã viết tắt ────────────────────────────────────
const PROVINCE_CODE_MAP: Record<string, string> = {
  "an giang": "AGG", "bà rịa vũng tàu": "BVT", "bắc giang": "BGG", "bắc kạn": "BKN",
  "bạc liêu": "BLU", "bắc ninh": "BNH", "bến tre": "BTE", "bình định": "BDH",
  "bình dương": "BDG", "bình phước": "BPC", "bình thuận": "BTN", "cà mau": "CMU",
  "cao bằng": "CBN", "cần thơ": "CTH", "đà nẵng": "DNG", "đắk lắk": "DLK",
  "đắk nông": "DNG2", "điện biên": "DBN", "đồng nai": "DNI", "đồng tháp": "DTP",
  "gia lai": "GLI", "hà giang": "HGG", "hà nam": "HNM", "hà nội": "HNI",
  "hà tĩnh": "HTH", "hải dương": "HDG", "hải phòng": "HPG", "hậu giang": "HGG2",
  "hòa bình": "HBH", "hưng yên": "HYN", "khánh hòa": "KHA", "kiên giang": "KGG",
  "kon tum": "KTM", "lai châu": "LCU", "lâm đồng": "LDG", "lạng sơn": "LSN",
  "lào cai": "LCI", "long an": "LAN", "nam định": "NDH", "nghệ an": "NAN",
  "ninh bình": "NBH", "ninh thuận": "NTN", "phú thọ": "PTO", "phú yên": "PYN",
  "quảng bình": "QBH", "quảng nam": "QNM", "quảng ngãi": "QNI", "quảng ninh": "QNN",
  "quảng trị": "QTI", "sóc trăng": "STG", "sơn la": "SLA", "tây ninh": "TNH",
  "thái bình": "TBH", "thái nguyên": "TNN", "thanh hóa": "THA", "thừa thiên huế": "HUE",
  "huế": "HUE", "tiền giang": "TGG", "tp hcm": "HCM", "hồ chí minh": "HCM",
  "trà vinh": "TVH", "tuyên quang": "TQG", "vĩnh long": "VLG", "vĩnh phúc": "VPC",
  "yên bái": "YBI",
};

function getProvinceCode(diaDiem: string): string {
  if (!diaDiem) return "";
  const normalized = diaDiem.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/[^a-z0-9 ]/g, " ").trim();
  // Try longest match first
  for (const [key, code] of Object.entries(PROVINCE_CODE_MAP)) {
    const normKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (normalized.includes(normKey)) return code;
  }
  // Fallback: use first 3 uppercase letters of last word
  const words = diaDiem.trim().split(" ");
  return words[words.length - 1].substring(0, 3).toUpperCase();
}

function getWordFileName(diaDiem: string): string {
  const code = getProvinceCode(diaDiem);
  const suffix = code ? ` ${code}` : "";
  return `Biện pháp luận Khảo sát thiết kế truyền dẫn${suffix}.docx`;
}

const EMPTY_PROJECT_INFO: ProjectInfo = {
  tenDuAn: "", soQuyetDinh: "", mucTieuDauTu: [], quyMoDauTu: "",
  diaDiemXayDung: "", loaiDuAn: "", nhomDuAn: "", capCongTrinh: "",
  soBuocThietKe: "", thoiGianThucHien: "", nguonVon: "", hinhThucQuanLy: "",
  thoiGianGoiThau: "", thoiGianGiamSat: "", thoiGianThanhQuyet: "",
};

export default function BienPhapLuanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [reqStates, setReqStates] = useState<ReqState[]>([]);
  const [copied, setCopied] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(EMPTY_PROJECT_INFO);
  const [quyMoGoiThau, setQuyMoGoiThau] = useState<QuyMoGoiThau[]>([]);
  const [projectInfoLoading, setProjectInfoLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<PreviewTab>("info");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Auto-search each requirement when done
  useEffect(() => {
    if (stage.step !== "done" || stage.requirements.length === 0) return;
    const reqs = stage.requirements;
    setReqStates(reqs.map(() => ({ loading: true, results: [], error: null })));
    setActiveTab("personnel");

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
    setProjectInfo(EMPTY_PROJECT_INFO);
    setQuyMoGoiThau([]);
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

      // Call both APIs in parallel
      const [requirementsRes, projectInfoRes] = await Promise.allSettled([
        fetch(`${BASE_URL}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }),
        fetch(`${BASE_URL}/api/analyze/project-info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }),
      ]);

      // Handle requirements
      if (requirementsRes.status === "rejected") throw new Error("Lỗi khi phân tích nhân sự");
      const reqResponse = requirementsRes.value;
      if (!reqResponse.ok) throw new Error(`Lỗi API: ${reqResponse.status}`);
      const reqData = await reqResponse.json();
      const raw = reqData.result ?? reqData.markdown ?? reqData.content ?? reqData;
      const requirements: Requirement[] = Array.isArray(raw) ? raw : [];

      // Handle project info
      if (projectInfoRes.status === "fulfilled" && projectInfoRes.value.ok) {
        const piData = await projectInfoRes.value.json();
        if (piData.projectInfo) setProjectInfo({ ...EMPTY_PROJECT_INFO, ...piData.projectInfo });
        if (Array.isArray(piData.quyMoGoiThau)) setQuyMoGoiThau(piData.quyMoGoiThau);
        setActiveTab("info");
      }

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
    setProjectInfo(EMPTY_PROJECT_INFO);
    setQuyMoGoiThau([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const copyJson = async (requirements: Requirement[]) => {
    await navigator.clipboard.writeText(JSON.stringify(requirements, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateProjectField = (field: keyof ProjectInfo, value: string) => {
    setProjectInfo(prev => ({ ...prev, [field]: value }));
  };

  const updateScopeRow = (idx: number, field: keyof QuyMoGoiThau, value: string) => {
    setQuyMoGoiThau(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: field === "khoiLuong" ? parseFloat(value) || value : value };
      return next;
    });
  };

  const addScopeRow = () => {
    setQuyMoGoiThau(prev => [...prev, { stt: prev.length + 1, moTaCongViec: "", donViTinh: "km", khoiLuong: 0 }]);
  };

  const deleteScopeRow = (idx: number) => {
    setQuyMoGoiThau(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, stt: i + 1 })));
  };

  // ─── Word Export — bám theo cấu trúc KSTK TRUYỀN DẪN.DOC ───────────────
  const downloadWord = async (requirements: Requirement[], states: ReqState[]) => {
    // ── Helpers ──
    const F = "Times New Roman";
    const border = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
    const cb = { top: border, bottom: border, left: border, right: border };
    const hb = { style: BorderStyle.SINGLE, size: 6, color: "1E3A5F" };
    const hcb = { top: hb, bottom: hb, left: hb, right: hb };

    const hCell = (text: string, w?: number) => new TableCell({
      borders: hcb,
      shading: { type: ShadingType.SOLID, fill: "1E3A5F" },
      width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 22, font: F })] })],
    });
    const dCell = (text: string, center = false, bold = false) => new TableCell({
      borders: cb,
      children: [new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: String(text ?? ""), size: 22, bold, font: F })] })],
    });

    const p = (text: string, bold = false, indent = 0, size = 22) => new Paragraph({
      indent: indent > 0 ? { left: convertInchesToTwip(indent) } : undefined,
      spacing: { after: 60 },
      children: [new TextRun({ text, bold, size, font: F })],
    });
    const pMixed = (parts: { text: string; bold?: boolean }[], indent = 0) => new Paragraph({
      indent: indent > 0 ? { left: convertInchesToTwip(indent) } : undefined,
      spacing: { after: 60 },
      children: parts.map(pt => new TextRun({ text: pt.text, bold: pt.bold, size: 22, font: F })),
    });
    const h1 = (text: string) => new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 140 },
      children: [new TextRun({ text, bold: true, size: 28, font: F })],
    });
    const h2 = (text: string) => new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text, bold: true, size: 26, font: F })],
    });
    const h3 = (text: string) => new Paragraph({
      spacing: { before: 140, after: 80 },
      children: [new TextRun({ text, bold: true, size: 24, font: F })],
    });
    const sp = () => new Paragraph({ children: [new TextRun({ text: "", font: F })], spacing: { after: 60 } });

    // ── Helpers cho bảng ──
    const eqipTable = (rows: { tt: string; name: string; unit?: string; qty?: string; own?: string }[], hasCols5: boolean) => {
      const headerRow = new TableRow({
        tableHeader: true,
        children: hasCols5
          ? [hCell("TT",8), hCell("Tên thiết bị",44), hCell("Đơn vị",12), hCell("Số lượng",12), hCell("Sở hữu",24)]
          : [hCell("TT",8), hCell("Tên thiết bị",92)],
      });
      const bodyRows = rows.map(r => new TableRow({
        children: hasCols5
          ? [dCell(r.tt, true), dCell(r.name), dCell(r.unit ?? "", true), dCell(r.qty ?? "", true), dCell(r.own ?? "", true)]
          : [dCell(r.tt, true), dCell(r.name)],
      }));
      return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] });
    };

    // ── Số liệu dự án (dòng vàng – từ AI) ──
    const tenDA = projectInfo.tenDuAn || "(chưa điền)";
    const soQD = projectInfo.soQuyetDinh || "";
    const mucTieu = projectInfo.mucTieuDauTu;
    const quyMo = projectInfo.quyMoDauTu || "";
    const diaDiem = projectInfo.diaDiemXayDung || "";
    const loaiDA = projectInfo.loaiDuAn || "";
    const nhomDA = projectInfo.nhomDuAn || "";
    const capCT = projectInfo.capCongTrinh || "";
    const buocTK = projectInfo.soBuocThietKe || "";
    const tgTH = projectInfo.thoiGianThucHien || "";
    const nguonV = projectInfo.nguonVon || "";
    const htQL = projectInfo.hinhThucQuanLy || "";
    const tgGT = projectInfo.thoiGianGoiThau || "";
    const tgGS = projectInfo.thoiGianGiamSat || "";
    const tgTQ = projectInfo.thoiGianThanhQuyet || "";

    // ── Bảng quy mô gói thầu (dòng vàng – từ AI) ──
    const scopeRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [hCell("STT",8), hCell("Mô tả công việc",60), hCell("Đơn vị tính",16), hCell("Khối lượng",16)],
      }),
      ...quyMoGoiThau.map(r => new TableRow({
        children: [dCell(String(r.stt), true), dCell(r.moTaCongViec), dCell(r.donViTinh, true), dCell(String(r.khoiLuong), true)],
      })),
    ];

    // ── Bảng nhân sự (dòng vàng – từ AI) ──
    const buildPersonnelTable = () => {
      const rows: TableRow[] = [new TableRow({
        tableHeader: true,
        children: [hCell("STT",8), hCell("Họ và tên",27), hCell("Trình độ chuyên môn",30), hCell("Công việc đảm nhận",35)],
      })];
      let stt = 1;
      requirements.forEach((req, i) => {
        (states[i]?.results ?? []).forEach(emp => {
          rows.push(new TableRow({
            children: [
              dCell(String(stt++), true),
              dCell(emp.name ?? ""),
              dCell(emp.valid_certificates?.join(", ") || emp.position || ""),
              dCell(req.query),
            ],
          }));
        });
      });
      return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
    };

    // ── Bảng thiết bị khảo sát (TRẮNG — giữ nguyên từ file gốc) ──
    const surveyEquip = eqipTable([
      { tt: "1", name: "La Bàn từ", unit: "Bộ", qty: "05", own: "Nhà thầu" },
      { tt: "2", name: "Máy định vị tọa độ GPS", unit: "Bộ", qty: "05", own: "Nhà thầu" },
      { tt: "3", name: "Xe đo chuyên dụng", unit: "Bộ", qty: "05", own: "Nhà thầu" },
      { tt: "4", name: "Máy đo khoảng cách", unit: "Bộ", qty: "05", own: "Nhà thầu" },
      { tt: "5", name: "Máy đo độ dốc", unit: "Bộ", qty: "05", own: "Nhà thầu" },
      { tt: "6", name: "Máy ảnh kỹ thuật số", unit: "Bộ", qty: "05", own: "Nhà thầu" },
      { tt: "7", name: "Máy tính xách tay", unit: "Bộ", qty: "05", own: "Nhà thầu" },
      { tt: "8", name: "Các loại thước đo độ dài (thước thép, thước dây)", unit: "Bộ", qty: "05", own: "Nhà thầu" },
      { tt: "9", name: "Phương tiện di chuyển bằng Ô tô", unit: "Xe", qty: "05", own: "Nhà Thầu" },
    ], true);

    // ── Bảng thiết bị thiết kế (TRẮNG — giữ nguyên từ file gốc) ──
    const designEquip = eqipTable([
      { tt: "I", name: "Máy móc, thiết bị phục vụ công tác thiết kế, lập dự toán" },
      { tt: "1", name: "Máy vi tính để bàn", unit: "Bộ", qty: "8", own: "Nhà thầu" },
      { tt: "2", name: "Máy in A4", unit: "Bộ", qty: "8", own: "Nhà thầu" },
      { tt: "3", name: "Máy in A3", unit: "Bộ", qty: "04", own: "Nhà thầu" },
      { tt: "4", name: "Máy scan A4", unit: "Bộ", qty: "04", own: "Nhà thầu" },
      { tt: "5", name: "Máy phôtô", unit: "Bộ", qty: "05", own: "Nhà thầu" },
      { tt: "II", name: "Phần mềm phục vụ công tác thiết kế, lập dự toán" },
      { tt: "1", name: "Phần mềm dự toán G8", unit: "Bộ", qty: "8", own: "Nhà thầu" },
      { tt: "2", name: "Phần mềm Autocad", unit: "Bộ", qty: "8", own: "Nhà thầu" },
      { tt: "3", name: "Phần mềm tin học văn phòng office", unit: "Bộ", qty: "8", own: "Nhà thầu" },
      { tt: "4", name: "Phần mềm hỗ trợ thiết kế (tự lập)", unit: "Bộ", qty: "4", own: "Nhà thầu" },
    ], true);

    // ═══════════════════════════════════════════════════════════════════════
    // DOCUMENT — bám theo cấu trúc file gốc KSTK TRUYỀN DẪN.DOC
    // Dòng TRẮNG = giữ nguyên  |  Dòng VÀNG = thay bằng dữ liệu AI
    // ═══════════════════════════════════════════════════════════════════════
    const doc = new Document({
      styles: { default: { document: { run: { font: F, size: 22 } } } },
      sections: [{
        properties: { page: { margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(0.8), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.2) } } },
        children: [
          // ── Tiêu đề (TRẮNG) ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [new TextRun({ text: "GIẢI PHÁP VÀ PHƯƠNG PHÁP LUẬN TỔNG QUÁT DO NHÀ THẦU ĐỀ XUẤT ĐỂ THỰC HIỆN DỊCH VỤ TƯ VẤN", bold: true, size: 26, font: F })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: "(ĐỀ XUẤT KỸ THUẬT)", bold: true, size: 24, font: F })],
          }),

          // ── 2.1. Am hiểu mục tiêu (TRẮNG) ──
          h2("2.1. Am hiểu mục tiêu của gói thầu đã nêu trong điều khoản tham chiếu."),
          h3("2.1.1. Mô tả khái quát về dự án và gói thầu"),
          h3("2.1.1.1. Mô tả khái quát dự án:"),

          // ── Thông tin dự án (VÀNG — thay bằng dữ liệu AI) ──
          pMixed([{ text: "- Tên dự án: ", bold: true }, { text: tenDA }]),
          pMixed([{ text: "- Số quyết định phê duyệt dự án: ", bold: true }, { text: soQD }]),
          pMixed([{ text: "- Mục tiêu đầu tư:", bold: true }]),
          ...mucTieu.map(mt => p(`    + ${mt}`)),
          pMixed([{ text: "- Quy mô đầu tư: ", bold: true }, { text: quyMo }]),
          pMixed([{ text: "- Địa điểm xây dựng: ", bold: true }, { text: diaDiem }]),
          pMixed([{ text: "- Loại dự án: ", bold: true }, { text: loaiDA }]),
          pMixed([{ text: "- ", bold: false }, { text: nhomDA }]),
          pMixed([{ text: "- Loại, cấp công trình chính, thời hạn sử dụng của công trình chính theo thiết kế (nếu có): ", bold: true }, { text: capCT }]),
          pMixed([{ text: "- Số bước thiết kế: ", bold: true }, { text: buocTK }]),
          pMixed([{ text: "- Thời gian thực hiện dự án: ", bold: true }, { text: tgTH }]),
          pMixed([{ text: "- Nguồn vốn: ", bold: true }, { text: nguonV }]),
          pMixed([{ text: "- Hình thức tổ chức quản lý dự án: ", bold: true }, { text: htQL }]),
          sp(),

          // ── Mô tả gói thầu (VÀNG) ──
          h3("2.1.1.2. Mô tả gói thầu:"),
          pMixed([{ text: "- Tên gói thầu: ", bold: true }, { text: `Tư vấn khảo sát, lập hồ sơ thiết kế bản vẽ thi công: ${tenDA}` }]),
          pMixed([{ text: "- Ủy quyền Chủ đầu tư: ", bold: true }, { text: "Tổng Công ty Mạng lưới Viettel - Chi nhánh Tập đoàn Công nghiệp - Viễn thông Quân đội." }]),
          pMixed([{ text: "- Thời gian thực hiện hợp đồng: ", bold: true }, { text: tgGT ? `${parseInt(tgGT) + parseInt(tgGS || "0") + parseInt(tgTQ || "0")} ngày. Trong đó:` : "(chưa có dữ liệu). Trong đó:" }]),
          p(`    + Thời gian thực hiện gói thầu: ${tgGT}`, false, 0),
          p(`    + Thời gian giám sát tác giả: ${tgGS}`, false, 0),
          p(`    + Thời gian thanh quyết toán hợp đồng: ${tgTQ}`, false, 0),
          pMixed([{ text: "- Địa điểm xây dựng: ", bold: true }, { text: diaDiem }]),
          pMixed([{ text: "- Nguồn vốn: ", bold: true }, { text: nguonV }]),
          pMixed([{ text: "- Quy mô gói thầu:", bold: true }]),
          sp(),

          // ── Bảng quy mô gói thầu (VÀNG) ──
          ...(quyMoGoiThau.length > 0
            ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: scopeRows })]
            : [p("(Chưa có dữ liệu bảng quy mô gói thầu)", false)]
          ),
          sp(),

          // ── 2.1.1.3 Nhiệm vụ cụ thể (TRẮNG — giữ nguyên) ──
          h3("2.1.1.3. Mô tả các nhiệm vụ cụ thể nhà thầu phải tiến hành trong thời gian thực hiện hợp đồng tư vấn:"),
          p("- Lập phương án kỹ thuật khảo sát;"),
          p("- Lập phương án kỹ thuật khảo sát và thực hiện khoan địa chất (nếu có);"),
          p("- Khảo sát và lập báo cáo khảo sát;"),
          p("- Lập thiết kế và dự toán;"),
          p("- Các báo cáo khác theo yêu cầu của Chủ đầu tư;"),
          p("- Giám sát tác giả trong giai đoạn thi công dự án theo đúng quy định hiện hành;"),
          p("- Chịu trách nhiệm trước chủ đầu tư, trước pháp luật về các phần việc do tư vấn lập, về chất lượng sản phẩm tư vấn của mình trong hồ sơ lập thiết kế, dự toán cho dự án;"),
          p("- Chịu trách nhiệm chỉnh sửa hoàn tất hồ sơ trong vòng 5 ngày kể từ ngày nhận được hồ sơ đã có góp ý."),
          sp(),

          // ── 2.1.2. Báo cáo và thời gian thực hiện (TRẮNG) ──
          h3("2.1.2. Báo cáo và thời gian thực hiện:"),
          p("- Báo cáo tiến độ khảo sát: 1 tuần 1 lần"),
          p("- Báo cáo tiến độ thiết kế: 1 tuần 1 lần"),
          p("- Báo cáo tiến độ lập dự toán: 1 tuần 1 lần"),
          p("- Báo cáo tiến độ hoàn thiện hồ sơ sau thẩm: 1 tuần 1 lần"),
          sp(),

          // ── 2.2. Cách tiếp cận (TRẮNG) ──
          h2("2.2. Cách tiếp cận và phương pháp luận"),
          h3("2.2.1. Mô tả về phạm vi địa lý, nội dung đầu tư của các hạng mục gói thầu"),

          // ── 2.2.1.1 Phạm vi địa lý (VÀNG — dùng địa điểm AI) ──
          h3(`2.2.1.1. Mô tả về phạm vi địa lý của gói thầu`),
          p(`a. Địa điểm triển khai: ${diaDiem}`, true),
          p(`Gói thầu được triển khai tại khu vực ${diaDiem}, bao gồm các tuyến cáp quang cần khảo sát, thiết kế bản vẽ thi công theo quy mô đầu tư của dự án.`),
          sp(),

          // ── 2.2.1.2 Nội dung đầu tư (VÀNG) ──
          h3("2.2.1.2. Nội dung đầu tư xây dựng các hạng mục của gói thầu"),
          p(quyMo),
          sp(),

          // ── 2.2.2. Phương pháp khảo sát (TRẮNG — giữ nguyên hoàn toàn) ──
          h3("2.2.2. Trình bày nhiệm vụ, mục tiêu của công tác khảo sát và phương pháp khảo sát để thu thập số liệu"),
          h3("2.2.2.1. Các căn cứ và tiêu chuẩn áp dụng"),
          p("Căn cứ luật xây dựng số 50/2014/QH13 ngày 18/06/2014 của quốc hội khóa XIII kỳ họp thứ 7."),
          p("Căn cứ Nghị định số 175/2024/NĐ-CP ngày 30/12/2024 của Chính phủ về quy định chi tiết một số điều và biện pháp thi hành luật xây dựng về quản lý hoạt động xây dựng."),
          p("Quy chuẩn kỹ thuật quốc gia về lắp đặt mạng cáp ngoại vi viễn thông: QCVN 33:2019/BTTTT ngày 31/12/2019."),
          p("TCVN 8699:2011 Mạng viễn thông. Ống nhựa dùng cho tuyến cáp ngầm."),
          p("TCVN 8700:2011 Cống, bể, hầm, hố, rãnh kỹ thuật và tủ đấu cáp viễn thông."),
          p("TCVN 4419:1987 - Khảo sát cho Xây dựng - Nguyên tắc cơ bản."),
          sp(),

          h3("2.2.2.2. Nội dung khảo sát"),
          p("- Khảo sát thu thập số liệu và lập hồ sơ khảo sát theo đề cương khảo sát đã được phê duyệt."),
          p("- Lập báo cáo kết quả khảo sát trình chủ đầu tư phê duyệt."),

          // ── Khối lượng khảo sát (VÀNG — dùng quy mô từ AI) ──
          p(`- Khảo sát: ${quyMo}`, false),
          sp(),

          h3("2.2.2.3. Mục tiêu khảo sát"),
          p("- Thu thập các thông tin, số liệu hiện trạng của toàn tuyến cột, cống bể có sẵn định xây dựng để lập hồ sơ thiết kế và dự toán chi phí xây dựng công trình."),
          p("- Xác định hướng tuyến, lộ trình tuyến và khoảng cách sơ bộ giữa các cột, cống bể hiện có cũng như khoảng cách giữa các cột hoặc tuyến cống bể."),
          p("- Thu thập số liệu, điều kiện tự nhiên, kinh tế toàn tỉnh và khu vực đầu tư."),
          p("- Thu thập số liệu về cấu trúc mạng lưới hiện trạng, tình hình kinh doanh, tình hình phát triển dịch vụ của khu vực cần đầu tư."),
          p("- Điều tra, khảo sát số liệu về giá cả thị trường, nguồn cung cấp, chủng loại... làm cơ sở cho việc lập thiết kế bản vẽ thi công và dự toán."),
          p("- Lập báo cáo kết quả khảo sát trình chủ đầu tư phê duyệt."),
          sp(),

          // ── Phương pháp khảo sát (TRẮNG) ──
          h3("2.2.2.4. Phương pháp khảo sát để thu thập số liệu"),
          h3("2.2.2.4.1. Chuẩn bị tài liệu"),
          p("- Nghiên cứu các quy trình, quy phạm do ngành ban hành và quy định trong thiết kế."),
          p("- Các tiêu chuẩn kỹ thuật của ngành."),
          p("- Lập biểu đồ nhân sự, tiến độ triển khai công việc."),
          p("- Thu thập và phân tích những tài liệu về trắc địa, địa hình, địa vật đã có ở địa điểm xây dựng."),
          sp(),
          h3("2.2.2.4.2. Lập đề cương đi khảo sát, đo đạc"),
          p("- Chuẩn bị các tài liệu liên quan đến phần khảo sát thiết kế (sơ đồ tuyến cột cáp, tuyến hầm cống, bản đồ mặt bằng tuyến đường…)."),
          sp(),
          h3("2.2.2.4.3. Lập kế hoạch với chủ đầu tư (bên A)"),
          p("- Nhận bàn giao địa điểm từ chủ đầu tư (chủ đầu tư được ủy quyền cho các tỉnh bàn giao địa điểm)."),
          p("- Thống nhất phương án, giải pháp kỹ thuật."),
          p("- Lập nhiệm vụ khảo sát, phương án kỹ thuật khảo sát trình chủ Đầu tư phê duyệt."),
          p("- Phối hợp với chủ đầu tư và đơn vị quản lý hạ tầng mạng lưới (Viettel, VNPT, VTC, EVN…) để xác định hướng tuyến cần khảo sát."),
          p("- Ghi chép tổng hợp kết quả khảo sát, lập báo cáo khảo sát, đề xuất phương án thiết kế thi công xây dựng trình chủ đầu tư phê duyệt."),
          sp(),

          // ── Bảng nhân sự khảo sát (VÀNG — từ AI) ──
          h3("2.2.2.5. Danh sách nhân sự thực hiện công tác khảo sát"),
          buildPersonnelTable(),
          sp(),

          // ── Thiết bị khảo sát (TRẮNG) ──
          h3("2.2.2.6. Thiết bị, dụng cụ phục vụ công tác khảo sát"),
          surveyEquip,
          sp(),

          // ── Phần thiết kế (TRẮNG) ──
          h2("2.3. Phần thiết kế bản vẽ thi công - Lập dự toán"),
          h3("2.3.1. Quy trình thực hiện"),
          p("- Nhận nhiệm vụ thiết kế, hồ sơ và báo cáo khảo sát."),
          p("- Nghiên cứu tài liệu, số liệu khảo sát; phân tích, đánh giá kết quả khảo sát."),
          p("- Lập thuyết minh tính toán thiết kế, lập thuyết minh thiết kế bản vẽ thi công và dự toán."),
          p("- Kiểm tra tính chính xác của hồ sơ thiết kế, dự toán theo nội dung yêu cầu."),
          p("- Điều chỉnh, chỉnh sửa (nếu có) hồ sơ thiết kế, dự toán theo góp ý của các cơ quan liên quan."),
          p("- In theo quyết định phê duyệt của Chủ đầu tư, phô tô, đóng quyển hồ sơ bản vẽ thi công."),
          sp(),

          // ── Bảng nhân sự thiết kế (VÀNG — từ AI, tái sử dụng cùng danh sách) ──
          h3("2.3.2. Danh sách nhân sự thực hiện công tác thiết kế và lập dự toán"),
          buildPersonnelTable(),
          sp(),

          // ── Thiết bị thiết kế (TRẮNG) ──
          h3("2.3.3. Trang thiết bị, phần mềm phục vụ công tác thiết kế và lập dự toán"),
          designEquip,
          sp(),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getWordFileName(projectInfo.diaDiemXayDung);
    a.click();
    URL.revokeObjectURL(url);
  };

  const isProcessing = ["validating", "extracting", "sending"].includes(stage.step);
  const stageLabel: Record<string, string> = {
    validating: "Đang kiểm tra PDF...",
    extracting: "Đang trích xuất nội dung...",
    sending: "AI đang phân tích hồ sơ...",
  };

  const hasDoneData = stage.step === "done";
  const hasPreviewData = hasDoneData || projectInfo.tenDuAn !== "" || quyMoGoiThau.length > 0;

  return (
    <>
      <style>{`
        /* ─── Page layout ─────────────────────────── */
        .bpl-layout {
          display: flex;
          height: calc(100vh - 64px);
          overflow: hidden;
        }
        .bpl-left {
          flex: 0 0 55%;
          overflow-y: auto;
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
        }
        .bpl-right {
          flex: 0 0 45%;
          overflow-y: auto;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
        }

        /* ─── Upload zone ─────────────────────────── */
        .upload-zone {
          border: 2px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;
          transition: all 0.2s ease; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 200px; gap: 16px; text-align: center; padding: 36px;
        }
        .upload-zone.dragging { border-color: var(--color-primary); background: #eff6ff; }
        .upload-zone:hover { border-color: #94a3b8; background: white; box-shadow: var(--shadow-sm); }
        .pulse-ring {
          width: 56px; height: 56px; border-radius: 50%;
          background: #e0e7ff; color: var(--color-primary);
          display: flex; align-items: center; justify-content: center;
        }
        .pulse-ring svg { width: 28px; height: 28px; }

        /* ─── Spinner ─────────────────────────────── */
        .spinner { width: 40px; height: 40px; border-radius: 50%; border: 3px solid #e2e8f0; border-top-color: var(--color-primary); animation: spin 0.8s linear infinite; }
        .spinner-sm { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #e2e8f0; border-top-color: var(--color-primary); animation: spin 0.8s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ─── Chips ───────────────────────────────── */
        .chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500;
          background: white; color: var(--color-text-muted); border: 1px solid var(--color-border);
        }

        /* ─── Req cards ───────────────────────────── */
        .req-card { border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-bg-card); overflow: hidden; }
        .req-header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--color-border); background: #f8fafc; }
        .emp-row { display: flex; align-items: center; gap: 12px; padding: 9px 18px; border-bottom: 1px solid var(--color-border); }
        .emp-row:last-child { border-bottom: none; }

        /* ─── Preview panel ───────────────────────── */
        .preview-header {
          background: white;
          border-bottom: 1px solid var(--color-border);
          padding: 16px 20px 0;
          position: sticky; top: 0; z-index: 10;
        }
        .preview-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 15px; font-weight: 600; color: var(--color-text);
          margin-bottom: 12px;
        }
        .preview-tabs { display: flex; gap: 4px; }
        .preview-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px 8px 0 0;
          font-size: 13px; font-weight: 500; cursor: pointer;
          border: 1px solid transparent; border-bottom: none;
          transition: all 0.15s; color: var(--color-text-muted);
          background: transparent;
        }
        .preview-tab:hover { color: var(--color-text); background: #f1f5f9; }
        .preview-tab.active {
          background: #f8fafc; color: var(--color-primary);
          border-color: var(--color-border);
          border-bottom-color: #f8fafc;
        }
        .preview-tab svg { width: 14px; height: 14px; }
        .preview-body { padding: 20px; flex: 1; }

        /* ─── Info fields ─────────────────────────── */
        .info-field { margin-bottom: 14px; }
        .info-label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        .info-input {
          width: 100%; background: white; border: 1px solid var(--color-border);
          border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--color-text);
          outline: none; transition: all 0.15s; resize: vertical; font-family: inherit;
        }
        .info-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .info-input::placeholder { color: #94a3b8; }

        /* ─── Scope table ─────────────────────────── */
        .scope-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .scope-table th { background: #1e3a5f; color: white; padding: 8px 10px; text-align: center; font-size: 12px; font-weight: 600; }
        .scope-table td { padding: 6px 8px; border-bottom: 1px solid var(--color-border); vertical-align: middle; }
        .scope-table tbody tr:hover td { background: #f8fafc; }
        .scope-input { width: 100%; border: none; background: transparent; font-size: 13px; color: var(--color-text); outline: none; font-family: inherit; }
        .scope-input:focus { background: white; border: 1px solid var(--color-primary); border-radius: 4px; padding: 2px 4px; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }

        /* ─── Personnel preview table ─────────────── */
        .pers-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .pers-table th { background: #1e3a5f; color: white; padding: 8px 10px; text-align: center; font-weight: 600; }
        .pers-table td { padding: 7px 10px; border-bottom: 1px solid var(--color-border); }
        .pers-table tbody tr:hover td { background: #f0f9ff; }

        /* ─── Empty preview ───────────────────────── */
        .preview-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; min-height: 400px; text-align: center; gap: 12px; opacity: 0.5;
        }
        .preview-empty svg { width: 48px; height: 48px; color: #94a3b8; }

        /* ─── Badge ───────────────────────────────── */
        .preview-badge {
          display: inline-block; font-size: 11px; font-weight: 600;
          padding: 2px 8px; border-radius: 999px; margin-left: 6px;
        }
        .badge-loading { background: #fef3c7; color: #92400e; }
        .badge-done { background: #d1fae5; color: #065f46; }
      `}</style>

      {/* ─── Topbar ──────────────────────────────────────────────────────── */}
      <div className="topbar">
        <div>
          <div className="topbar-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 24, height: 24, color: "var(--color-primary)" }}>{Icons.robot}</span>
            Biện pháp luận — Phân tích Hồ sơ
          </div>
          <div className="topbar-subtitle">Upload PDF hồ sơ mời thầu để trích xuất, ghép nhân sự và xuất Word tự động</div>
        </div>
        {(stage.step === "done" || file) && (
          <button className="btn btn-ghost" onClick={reset}>
            <span style={{ width: 16, height: 16 }}>{Icons.refresh}</span> Làm lại
          </button>
        )}
      </div>

      {/* ─── 2-column layout ─────────────────────────────────────────────── */}
      <div className="bpl-layout">

        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <div className="bpl-left">
          <div style={{ padding: 24, flex: 1 }}>

            {/* IDLE */}
            {!file && stage.step === "idle" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{
                  background: "white", border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-sm)", borderRadius: 16, padding: "22px 26px",
                  display: "flex", gap: 20, alignItems: "center"
                }}>
                  <div style={{ width: 44, height: 44, color: "var(--color-primary)", flexShrink: 0 }}>{Icons.document}</div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>
                      Trích xuất yêu cầu nhân sự từ Hồ sơ mời thầu
                    </h2>
                    <p style={{ color: "var(--color-text-muted)", lineHeight: 1.6, fontSize: 13 }}>
                      Upload PDF hồ sơ mời thầu. AI sẽ trích xuất thông tin dự án, danh sách vị trí nhân sự,
                      sau đó tự động tìm ứng viên phù hợp. Xem trước nội dung Word ở panel bên phải.
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.document}</span> PDF dạng văn bản</span>
                      <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.robot}</span> AI phân tích</span>
                      <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.eye}</span> Preview Word</span>
                      <span className="chip"><span style={{ width: 14, height: 14 }}>{Icons.download}</span> Xuất Word</span>
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
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>
                      {dragging ? "Thả file vào đây" : "Kéo thả hồ sơ mời thầu"}
                    </div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 4 }}>
                      hoặc <span style={{ color: "var(--color-primary)", fontWeight: 500 }}>nhấn để chọn file PDF</span>
                    </div>
                  </div>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { icon: Icons.upload, step: "1", title: "Upload PDF", desc: "Chọn file hồ sơ mời thầu" },
                    { icon: Icons.cog, step: "2", title: "Trích xuất", desc: "AI đọc và phân tích nội dung" },
                    { icon: Icons.users, step: "3", title: "Ghép nhân sự", desc: "Tự động tìm ứng viên phù hợp" },
                    { icon: Icons.eye, step: "4", title: "Preview & Xuất", desc: "Xem trước và tải về Word" },
                  ].map(s => (
                    <div key={s.step} className="stat-card" style={{ flexDirection: "column", gap: 10, padding: 16, alignItems: "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}>{s.step}</div>
                        <span style={{ width: 18, height: 18, color: "var(--color-primary)" }}>{s.icon}</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 13, marginBottom: 3 }}>{s.title}</div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.4 }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ERROR */}
            {stage.step === "error" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ width: 22, height: 22, color: "#dc2626" }}>{Icons.warning}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>Đã xảy ra lỗi</div>
                    <div style={{ color: "#b91c1c", fontSize: 13 }}>{stage.message}</div>
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
                background: "white", borderRadius: 16, border: "1px solid var(--color-border)"
              }}>
                <div className="spinner" />
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text)", marginBottom: 6 }}>{stageLabel[stage.step]}</div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{file?.name} · Vui lòng chờ...</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {(["validating", "extracting", "sending"] as const).map((s, i) => {
                    const current = ["validating", "extracting", "sending"].indexOf(stage.step);
                    return (
                      <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: i < current ? "#10b981" : i === current ? "var(--color-primary)" : "#e2e8f0",
                          boxShadow: i === current ? "0 0 0 4px #dbeafe" : undefined,
                          transition: "all 0.3s",
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: i <= current ? "var(--color-text)" : "var(--color-text-muted)" }}>
                          {["Kiểm tra", "Trích xuất", "Phân tích AI"][i]}
                        </span>
                        {i < 2 && <div style={{ width: 28, height: 2, background: i < current ? "#10b981" : "#e2e8f0" }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DONE */}
            {stage.step === "done" && (
              <div ref={resultRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Banner */}
                <div style={{
                  background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: "14px 18px",
                  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 24, height: 24, color: "#059669" }}>{Icons.check}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: "#065f46", fontSize: 14 }}>
                        Tìm thấy {stage.requirements.length} vị trí · {stage.requirements.reduce((s, r) => s + (r.count || 1), 0)} người cần
                      </div>
                      <div style={{ color: "#047857", fontSize: 12, marginTop: 2 }}>
                        {stage.pageCount} trang · {stage.chars.toLocaleString()} ký tự · Thông tin dự án {projectInfo.tenDuAn ? "✓" : "chưa tải"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => copyJson(stage.requirements)} style={{ background: "white" }}>
                      <span style={{ width: 14, height: 14 }}>{copied ? Icons.check : Icons.copy}</span>
                      {copied ? "Đã sao chép" : "Copy JSON"}
                    </button>
                    {reqStates.length > 0 && reqStates.every(rs => !rs.loading) && (
                      <button className="btn btn-primary btn-sm" onClick={() => downloadWord(stage.requirements, reqStates)}>
                        <span style={{ width: 14, height: 14 }}>{Icons.download}</span> Tải Word
                      </button>
                    )}
                  </div>
                </div>

                {/* Personnel Requirements Summary Table */}
                <div style={{ background: "white", borderRadius: 12, border: "1px solid var(--color-border)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-border)", background: "#f8fafc", fontWeight: 600, fontSize: 14 }}>
                    Bảng tổng hợp yêu cầu nhân sự
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9", color: "var(--color-text-muted)" }}>
                          <th style={{ padding: "10px 18px", borderBottom: "1px solid var(--color-border)", fontWeight: 600, width: "5%" }}>STT</th>
                          <th style={{ padding: "10px 18px", borderBottom: "1px solid var(--color-border)", fontWeight: 600, width: "35%" }}>Vị trí / Công việc đảm nhận</th>
                          <th style={{ padding: "10px 18px", borderBottom: "1px solid var(--color-border)", fontWeight: 600, width: "15%" }}>Số lượng cần</th>
                          <th style={{ padding: "10px 18px", borderBottom: "1px solid var(--color-border)", fontWeight: 600, width: "45%" }}>Yêu cầu kinh nghiệm & chứng chỉ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stage.requirements.map((req, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                            <td style={{ padding: "12px 18px", color: "var(--color-text-muted)", fontWeight: 500 }}>{i + 1}</td>
                            <td style={{ padding: "12px 18px", fontWeight: 500, color: "var(--color-text)" }}>{req.query}</td>
                            <td style={{ padding: "12px 18px", fontWeight: 600, color: "var(--color-primary)" }}>{req.count > 0 ? req.count : 1}</td>
                            <td style={{ padding: "12px 18px" }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {req.min_years_experience != null && (
                                  <span style={{ fontSize: 11, background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: 5, border: "1px solid #bfdbfe" }}>≥ {req.min_years_experience} năm KN</span>
                                )}
                                {req.must_have_certificates.map(cert => (
                                  <span key={cert} style={{ fontSize: 11, background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: 5, border: "1px solid #a7f3d0" }}>{cert}</span>
                                ))}
                                {req.min_years_experience == null && req.must_have_certificates.length === 0 && (
                                  <span style={{ color: "var(--color-text-muted)", fontStyle: "italic", fontSize: 12 }}>Không có yêu cầu đặc biệt</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Requirement cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {stage.requirements.map((req, i) => {
                    const rs = reqStates[i];
                    const needed = req.count > 0 ? req.count : 1;
                    const found = rs?.results.length ?? 0;
                    return (
                      <div key={i} className="req-card">
                        <div className="req-header">
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--color-primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>{req.query}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: "#e0e7ff", color: "#4338ca" }}>Cần {needed} người</span>
                              {req.min_years_experience != null && (
                                <span style={{ fontSize: 11, background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: 5 }}>≥ {req.min_years_experience} năm KN</span>
                              )}
                              {req.must_have_certificates.map(cert => (
                                <span key={cert} style={{ fontSize: 11, background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: 5 }}>{cert}</span>
                              ))}
                            </div>
                          </div>
                          {rs && !rs.loading && (
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 18, fontWeight: 700, color: found >= needed ? "#059669" : "#d97706" }}>{found}/{needed}</div>
                              <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>tìm được</div>
                            </div>
                          )}
                        </div>
                        {!rs || rs.loading ? (
                          <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 8, color: "var(--color-text-muted)", fontSize: 13 }}>
                            <div className="spinner-sm" /> Đang tìm kiếm...
                          </div>
                        ) : rs.error ? (
                          <div style={{ padding: "10px 18px", fontSize: 12, color: "#b91c1c" }}>Lỗi: {rs.error}</div>
                        ) : rs.results.length === 0 ? (
                          <div style={{ padding: "14px 18px", fontSize: 13, color: "var(--color-text-muted)" }}>Không tìm thấy nhân sự phù hợp</div>
                        ) : (
                          rs.results.map((emp, j) => (
                            <div key={emp.employee_id ?? j} className="emp-row">
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", width: 18, textAlign: "center", flexShrink: 0 }}>{j + 1}</div>
                              <div className="avatar" style={{ background: getColor(emp.name ?? "?"), flexShrink: 0, width: 30, height: 30, fontSize: 11 }}>
                                {getInitials(emp.name ?? "?")}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text)" }}>{emp.name}</div>
                                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                                  {emp.position || "—"}{emp.department ? ` · ${emp.department}` : ""}{emp.years_of_experience != null ? ` · ${emp.years_of_experience} năm KN` : ""}
                                </div>
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "flex-end", maxWidth: 220 }}>
                                {emp.valid_certificates?.slice(0, 2).map(c => (
                                  <span key={c} style={{ fontSize: 10, background: "#ecfdf5", color: "#059669", padding: "2px 6px", borderRadius: 5 }}>{c}</span>
                                ))}
                                {(emp.valid_certificates?.length ?? 0) > 2 && (
                                  <span style={{ fontSize: 10, background: "#f1f5f9", color: "#475569", padding: "2px 6px", borderRadius: 5 }}>+{emp.valid_certificates.length - 2}</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5, flexShrink: 0, background: `${scoreColor(emp.score)}18`, color: scoreColor(emp.score) }}>
                                {(emp.score * 100).toFixed(0)}%
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — Preview ───────────────────────────────────────── */}
        <div className="bpl-right">
          <div className="preview-header">
            <div className="preview-title">
              <span style={{ width: 18, height: 18, color: "var(--color-primary)" }}>{Icons.eye}</span>
              Preview nội dung Word
              {projectInfoLoading && <span className="preview-badge badge-loading">Đang tải...</span>}
              {hasPreviewData && !projectInfoLoading && <span className="preview-badge badge-done">Sẵn sàng</span>}
            </div>
            <div className="preview-tabs">
              <button
                id="tab-info"
                className={`preview-tab ${activeTab === "info" ? "active" : ""}`}
                onClick={() => setActiveTab("info")}
              >
                <span style={{ width: 14, height: 14 }}>{Icons.info}</span> Thông tin dự án
              </button>
              <button
                id="tab-scope"
                className={`preview-tab ${activeTab === "scope" ? "active" : ""}`}
                onClick={() => setActiveTab("scope")}
              >
                <span style={{ width: 14, height: 14 }}>{Icons.table}</span> Quy mô gói thầu
              </button>
              <button
                id="tab-personnel"
                className={`preview-tab ${activeTab === "personnel" ? "active" : ""}`}
                onClick={() => setActiveTab("personnel")}
              >
                <span style={{ width: 14, height: 14 }}>{Icons.users}</span> Nhân sự
                {reqStates.some(r => r.loading) && <span className="preview-badge badge-loading" style={{ fontSize: 10 }}>...</span>}
              </button>
            </div>
          </div>

          <div className="preview-body">
            {/* Empty state */}
            {!hasPreviewData && !isProcessing && (
              <div className="preview-empty">
                <span>{Icons.eye}</span>
                <div style={{ fontWeight: 600, color: "var(--color-text-muted)", fontSize: 15 }}>Chưa có dữ liệu</div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>Upload PDF để xem trước nội dung Word sẽ xuất</div>
              </div>
            )}

            {isProcessing && (
              <div className="preview-empty" style={{ opacity: 1 }}>
                <div className="spinner" />
                <div style={{ fontWeight: 600, color: "var(--color-text-muted)", fontSize: 14 }}>AI đang phân tích hồ sơ...</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Thông tin dự án sẽ hiển thị ở đây sau khi xử lý xong</div>
              </div>
            )}

            {/* ── TAB 1: Project Info ──────────────────────────────────── */}
            {hasPreviewData && !isProcessing && activeTab === "info" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>I. THÔNG TIN CHUNG DỰ ÁN</div>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 12, height: 12 }}>{Icons.edit}</span> Có thể chỉnh sửa
                  </span>
                </div>

                <div className="info-field">
                  <div className="info-label">Tên dự án</div>
                  <textarea className="info-input" rows={2} placeholder="Nhập tên dự án..."
                    value={projectInfo.tenDuAn}
                    onChange={e => updateProjectField("tenDuAn", e.target.value)} />
                </div>

                <div className="info-field">
                  <div className="info-label">Số quyết định phê duyệt</div>
                  <input type="text" className="info-input" placeholder="Ví dụ: 230641/QĐ-ssVTNet ngày 29 tháng 6 năm 2025"
                    value={projectInfo.soQuyetDinh}
                    onChange={e => updateProjectField("soQuyetDinh", e.target.value)} />
                </div>

                <div className="info-field">
                  <div className="info-label">Mục tiêu đầu tư</div>
                  <textarea className="info-input" rows={3} placeholder="Mỗi mục tiêu một dòng..."
                    value={projectInfo.mucTieuDauTu.join("\n")}
                    onChange={e => setProjectInfo(prev => ({ ...prev, mucTieuDauTu: e.target.value.split("\n").filter(Boolean) }))} />
                </div>

                <div className="info-field">
                  <div className="info-label">Quy mô đầu tư</div>
                  <textarea className="info-input" rows={2} placeholder="Mô tả quy mô đầu tư..."
                    value={projectInfo.quyMoDauTu}
                    onChange={e => updateProjectField("quyMoDauTu", e.target.value)} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { key: "diaDiemXayDung", label: "Địa điểm xây dựng" },
                    { key: "loaiDuAn", label: "Loại dự án" },
                    { key: "nhomDuAn", label: "Nhóm dự án" },
                    { key: "capCongTrinh", label: "Cấp công trình" },
                    { key: "soBuocThietKe", label: "Số bước thiết kế" },
                    { key: "thoiGianThucHien", label: "Thời gian thực hiện" },
                    { key: "nguonVon", label: "Nguồn vốn" },
                    { key: "hinhThucQuanLy", label: "Hình thức quản lý" },
                  ].map(({ key, label }) => (
                    <div key={key} className="info-field" style={{ marginBottom: 10 }}>
                      <div className="info-label">{label}</div>
                      <input type="text" className="info-input" placeholder={`Nhập ${label.toLowerCase()}...`}
                        value={(projectInfo as any)[key]}
                        onChange={e => updateProjectField(key as keyof ProjectInfo, e.target.value)} />
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 10 }}>THỜI GIAN GÓI THẦU</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {[
                      { key: "thoiGianGoiThau", label: "Thực hiện gói thầu" },
                      { key: "thoiGianGiamSat", label: "Giám sát tác giả" },
                      { key: "thoiGianThanhQuyet", label: "Thanh quyết toán HĐ" },
                    ].map(({ key, label }) => (
                      <div key={key} className="info-field" style={{ marginBottom: 0 }}>
                        <div className="info-label" style={{ fontSize: 10 }}>{label}</div>
                        <input type="text" className="info-input" placeholder="VD: 120 ngày"
                          value={(projectInfo as any)[key]}
                          onChange={e => updateProjectField(key as keyof ProjectInfo, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: Scope Table ───────────────────────────────────── */}
            {hasPreviewData && !isProcessing && activeTab === "scope" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>II. QUY MÔ GÓI THẦU</div>
                  <button className="btn btn-ghost btn-sm" onClick={addScopeRow}>+ Thêm hàng</button>
                </div>

                {quyMoGoiThau.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-muted)", fontSize: 13 }}>
                    Chưa có dữ liệu bảng quy mô gói thầu.<br />
                    <span style={{ color: "var(--color-primary)", cursor: "pointer" }} onClick={addScopeRow}>Nhấn để thêm hàng</span>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--color-border)" }}>
                    <table className="scope-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>STT</th>
                          <th style={{ textAlign: "left" }}>Mô tả công việc</th>
                          <th style={{ width: 80 }}>Đơn vị</th>
                          <th style={{ width: 80 }}>Khối lượng</th>
                          <th style={{ width: 36 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {quyMoGoiThau.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: "center", color: "var(--color-text-muted)", fontWeight: 600 }}>{row.stt}</td>
                            <td>
                              <input className="scope-input" value={row.moTaCongViec}
                                onChange={e => updateScopeRow(idx, "moTaCongViec", e.target.value)} />
                            </td>
                            <td>
                              <input className="scope-input" style={{ textAlign: "center" }} value={row.donViTinh}
                                onChange={e => updateScopeRow(idx, "donViTinh", e.target.value)} />
                            </td>
                            <td>
                              <input className="scope-input" style={{ textAlign: "center" }} value={String(row.khoiLuong)}
                                onChange={e => updateScopeRow(idx, "khoiLuong", e.target.value)} />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button onClick={() => deleteScopeRow(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16, lineHeight: 1 }}>×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: Personnel Preview ─────────────────────────────── */}
            {hasPreviewData && !isProcessing && activeTab === "personnel" && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 14 }}>
                  III. DANH SÁCH NHÂN SỰ ĐỀ XUẤT
                </div>

                {reqStates.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-muted)", fontSize: 13 }}>
                    Nhân sự sẽ hiển thị ở đây sau khi phân tích xong
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--color-border)" }}>
                    <table className="pers-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>STT</th>
                          <th style={{ textAlign: "left" }}>Họ và tên</th>
                          <th style={{ textAlign: "left" }}>Trình độ CM</th>
                          <th style={{ textAlign: "left" }}>Công việc đảm nhận</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stage.step === "done" && reqStates.map((rs, i) => {
                          const req = stage.requirements[i];
                          if (rs.loading) {
                            return (
                              <tr key={`loading-${i}`}>
                                <td colSpan={4} style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 12, padding: "10px" }}>
                                  <div className="spinner-sm" style={{ display: "inline-block", marginRight: 6 }} />
                                  Đang tìm nhân sự cho: {req?.query}
                                </td>
                              </tr>
                            );
                          }
                          return rs.results.map((emp, j) => (
                            <tr key={`${i}-${j}`}>
                              <td style={{ textAlign: "center", color: "var(--color-text-muted)", fontWeight: 700, fontSize: 12 }}>
                                {reqStates.slice(0, i).reduce((sum, r) => sum + r.results.length, 0) + j + 1}
                              </td>
                              <td style={{ fontWeight: 600 }}>{emp.name}</td>
                              <td style={{ fontSize: 12 }}>{emp.valid_certificates?.join(", ") || emp.position || "—"}</td>
                              <td style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{req?.query}</td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {stage.step === "done" && reqStates.length > 0 && reqStates.every(rs => !rs.loading) && (
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={() => downloadWord(stage.requirements, reqStates)}>
                      <span style={{ width: 16, height: 16 }}>{Icons.download}</span> Tải về Word đầy đủ
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
