"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import Link from "next/link";

type Stats = { employees: number; certificates: number; valid: number; expiring: number; };

const Icons = {
  users: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  document: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  check: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  warning: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  robot: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h0m6 0h0m-6 4h6" /></svg>
};

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({ employees: 0, certificates: 0, valid: 0, expiring: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<{ id: string }[]>("/api/employees"),
      apiRequest<{ id: string; status: string }[]>("/api/certificates"),
    ]).then(([emps, certs]) => {
      setStats({
        employees: emps.length,
        certificates: certs.length,
        valid: certs.filter(c => c.status === "Còn hạn").length,
        expiring: certs.filter(c => c.status === "Sắp hết hạn").length,
      });
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Không thể kết nối đến máy chủ");
    }).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Dashboard</div>
          <div className="topbar-subtitle">Tổng quan hệ thống DDM501</div>
        </div>
        <Link href="/bien-phap-luan" className="btn btn-primary">
          <span style={{ width: 16, height: 16, display: "inline-block", marginRight: 4 }}>{Icons.robot}</span> Mở AI Biện pháp luận
        </Link>
      </div>

      <div className="page-content">
        {/* Hero CTA */}
        <div style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-sm)",
          borderRadius: 16, padding: "32px",
          display: "flex", gap: 24, alignItems: "center",
          marginBottom: 24
        }}>
          <div style={{ width: 64, height: 64, color: "var(--color-primary)", flexShrink: 0 }}>
            {Icons.robot}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
              Phân tích Hồ sơ & Tạo Biện pháp luận
            </h2>
            <p style={{ color: "var(--color-text-muted)", lineHeight: 1.6, fontSize: 14, marginBottom: 16 }}>
              Hệ thống tự động đọc văn bản từ hồ sơ mời thầu và ứng dụng AI phân tích yêu cầu kỹ thuật để xây dựng bộ Biện pháp luận hoàn chỉnh dạng Markdown.
            </p>
            <Link href="/bien-phap-luan" className="btn btn-primary">
              Bắt đầu ngay →
            </Link>
          </div>
          <div style={{
            background: "#f8fafc", border: "1px solid #e2e8f0",
            borderRadius: 12, padding: "16px 24px", textAlign: "center", minWidth: 140
          }}>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600, marginBottom: 8 }}>TRẠNG THÁI AI</div>
            <div style={{ width: 28, height: 28, color: "#10b981", margin: "0 auto" }}>
              {Icons.check}
            </div>
            <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, marginTop: 8 }}>Sẵn sàng</div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8,
            padding: "12px 16px", marginBottom: 16, color: "#b91c1c", fontSize: 14
          }}>
            Lỗi tải dữ liệu: {error}
          </div>
        )}

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#f1f5f9", color: "#475569" }}>{Icons.users}</div>
            <div><div className="stat-value">{loading ? "…" : stats.employees}</div><div className="stat-label">Nhân sự</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#f1f5f9", color: "#475569" }}>{Icons.document}</div>
            <div><div className="stat-value">{loading ? "…" : stats.certificates}</div><div className="stat-label">Chứng chỉ</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>{Icons.check}</div>
            <div><div className="stat-value">{loading ? "…" : stats.valid}</div><div className="stat-label">Còn hiệu lực</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}>{Icons.warning}</div>
            <div><div className="stat-value">{loading ? "…" : stats.expiring}</div><div className="stat-label">Sắp/Đã hết hạn</div></div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Link href="/employees" className="stat-card" style={{ textDecoration: "none", flexDirection: "column", alignItems: "flex-start", padding: 24, gap: 12 }}>
            <div style={{ width: 32, height: 32, color: "var(--color-primary)" }}>{Icons.users}</div>
            <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 16 }}>Quản lý Nhân sự</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Tra cứu thông tin, chức vụ, bộ phận công tác và quá trình của nhân sự.</div>
          </Link>
          <Link href="/certificates" className="stat-card" style={{ textDecoration: "none", flexDirection: "column", alignItems: "flex-start", padding: 24, gap: 12 }}>
            <div style={{ width: 32, height: 32, color: "var(--color-primary)" }}>{Icons.document}</div>
            <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 16 }}>Quản lý Chứng chỉ</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Theo dõi văn bằng chứng chỉ, thời hạn hiệu lực và tài liệu scan đính kèm.</div>
          </Link>
        </div>
      </div>
    </>
  );
}
