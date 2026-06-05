"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import UploadZone from "@/components/UploadZone";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const Icons = {
  document: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  check: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  warning: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  ban: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  search: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  plus: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  clip: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
};

type Certificate = {
  id: string;
  employee_id: string;
  type: string;
  rank: string | null;
  certificate_number: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  file_name: string | null;
  file_url: string | null;
  employees?: { name: string; employee_code: string };
};

type Employee = { id: string; name: string; employee_code: string; };

const STATUS_BADGE: Record<string, string> = {
  "Còn hạn": "badge badge-green",
  "Sắp hết hạn": "badge badge-yellow",
  "Quá hạn": "badge badge-red",
};

const CERT_TYPES = [
  "Giám sát công tác xây dựng công trình dân dụng - công nghiệp và Hạ tầng Kỹ thuật",
  "Thiết kế kết cấu công trình",
  "Quản lý dự án đầu tư xây dựng công trình dân dụng - công nghiệp và Hạ tầng kỹ thuật",
  "An toàn lao động",
  "Khác",
];

type FormState = { employee_id: string; type: string; rank: string; certificate_number: string; start_date: string; end_date: string; status: string; };
const EMPTY_FORM: FormState = { employee_id: "", type: "", rank: "", certificate_number: "", start_date: "", end_date: "", status: "Còn hạn" };

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [certs, emps] = await Promise.all([
        apiRequest<Certificate[]>("/api/certificates"),
        apiRequest<Employee[]>("/api/employees"),
      ]);
      setCertificates(certs);
      setEmployees(emps);
      setFetchError(null);
    } catch (err: any) {
      setFetchError(err instanceof Error ? err.message : "Không thể kết nối đến máy chủ");
    } finally { setLoading(false); }
  };

  const filtered = certificates.filter(c => {
    const matchSearch =
      (c.employees?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.type || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.certificate_number || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setFile(null); setShowModal(true); };
  const openEdit = (c: Certificate) => {
    setForm({
      employee_id: c.employee_id,
      type: c.type,
      rank: c.rank || "",
      certificate_number: c.certificate_number || "",
      start_date: c.start_date ? c.start_date.substring(0, 10) : "",
      end_date: c.end_date ? c.end_date.substring(0, 10) : "",
      status: c.status,
    });
    setEditId(c.id);
    setFile(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      (Object.entries(form) as [string, string][]).forEach(([k, v]) => { if (v) formData.append(k, v); });
      if (file) formData.append("file", file);
      const method = editId ? "PUT" : "POST";
      const url = editId ? `/api/certificates/${editId}` : "/api/certificates";
      await apiRequest(url, { method, body: formData });
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert("Đã có lỗi xảy ra: " + err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/certificates/${id}`, { method: "DELETE" });
      setDeleteId(null);
      fetchData();
    } catch (err: any) {
      alert("Xóa thất bại: " + (err instanceof Error ? err.message : "Lỗi không xác định"));
    }
  };

  const counts = {
    total: certificates.length,
    valid: certificates.filter(c => c.status === "Còn hạn").length,
    soon: certificates.filter(c => c.status === "Sắp hết hạn").length,
    expired: certificates.filter(c => c.status === "Quá hạn").length,
  };

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Quản lý Chứng chỉ</div>
          <div className="topbar-subtitle">{certificates.length} chứng chỉ trong hệ thống</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <span style={{ width: 16, height: 16 }}>{Icons.plus}</span> Thêm chứng chỉ
        </button>
      </div>

      <div className="page-content">
        {fetchError && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8,
            padding: "12px 16px", marginBottom: 16, color: "#b91c1c", fontSize: 14
          }}>
            Lỗi tải dữ liệu: {fetchError}
          </div>
        )}

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#f1f5f9", color: "#475569" }}>{Icons.document}</div>
            <div><div className="stat-value">{counts.total}</div><div className="stat-label">Tổng chứng chỉ</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>{Icons.check}</div>
            <div><div className="stat-value">{counts.valid}</div><div className="stat-label">Còn hạn</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}>{Icons.warning}</div>
            <div><div className="stat-value">{counts.soon}</div><div className="stat-label">Sắp hết hạn</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>{Icons.ban}</div>
            <div><div className="stat-value">{counts.expired}</div><div className="stat-label">Quá hạn</div></div>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Danh sách chứng chỉ</span>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <select
                className="form-select"
                style={{ width: 160, padding: "8px 12px" }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option>Còn hạn</option>
                <option>Sắp hết hạn</option>
                <option>Quá hạn</option>
              </select>
              <div className="search-wrapper">
                <span className="search-icon">{Icons.search}</span>
                <input className="search-input" placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>Đang tải...</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nhân sự</th>
                    <th>Loại chứng chỉ</th>
                    <th>Số chứng chỉ</th>
                    <th>Hiệu lực</th>
                    <th>Trạng thái</th>
                    <th>File</th>
                    <th style={{ textAlign: "right" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map(cert => (
                    <tr key={cert.id}>
                      <td>
                        <div className="table-name">{cert.employees?.name || "—"}</div>
                        <div className="table-sub">{cert.employees?.employee_code}</div>
                      </td>
                      <td>
                        <div style={{ maxWidth: 280, lineHeight: 1.4, color: "var(--color-text)", fontSize: 13 }}>{cert.type}</div>
                        {cert.rank && <div className="table-sub">Hạng {cert.rank}</div>}
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{cert.certificate_number || "—"}</td>
                      <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                        {cert.start_date ? new Date(cert.start_date).toLocaleDateString("vi-VN") : "—"}
                        {cert.end_date && <> → {new Date(cert.end_date).toLocaleDateString("vi-VN")}</>}
                      </td>
                      <td>
                        <span className={STATUS_BADGE[cert.status] || "badge badge-gray"}>{cert.status}</span>
                      </td>
                      <td>
                        {cert.file_url
                          ? <a href={`${BASE}${cert.file_url}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                              <span style={{ width: 14, height: 14 }}>{Icons.clip}</span> Xem
                            </a>
                          : <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>—</span>
                        }
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(cert)}>Sửa</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(cert.id)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: 48, color: "var(--color-text-muted)" }}>Không tìm thấy kết quả</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderTop: "1px solid var(--color-border)" }}>
              <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
                Hiển thị {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filtered.length)} trong tổng số {filtered.length}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button 
                  className="btn btn-ghost btn-sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Trước
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button 
                    key={p} 
                    className={`btn btn-sm ${currentPage === p ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setCurrentPage(p)}
                    style={currentPage === p ? {} : { fontWeight: 400 }}
                  >
                    {p}
                  </button>
                ))}
                <button 
                  className="btn btn-ghost btn-sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <span className="card-title">{editId ? "Cập nhật chứng chỉ" : "Thêm chứng chỉ mới"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: "1/-1" }}>
                    <label className="form-label">Nhân sự *</label>
                    <select className="form-select" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} required>
                      <option value="">-- Chọn nhân sự --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: "1/-1" }}>
                    <label className="form-label">Loại chứng chỉ *</label>
                    <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} required>
                      <option value="">-- Chọn loại --</option>
                      {CERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hạng</label>
                    <select className="form-select" value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value })}>
                      <option value="">Không có</option>
                      <option value="I">Hạng I</option>
                      <option value="II">Hạng II</option>
                      <option value="III">Hạng III</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số chứng chỉ *</label>
                    <input className="form-input" placeholder="VD: HCM-00194500" value={form.certificate_number} onChange={e => setForm({ ...form, certificate_number: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ngày cấp</label>
                    <input type="date" className="form-input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ngày hết hạn</label>
                    <input type="date" className="form-input" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Trạng thái</label>
                    <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option>Còn hạn</option>
                      <option>Sắp hết hạn</option>
                      <option>Quá hạn</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: "1/-1" }}>
                    <label className="form-label">Upload file chứng chỉ (PDF)</label>
                    <UploadZone onFileReady={f => setFile(f)} onFileRemoved={() => setFile(null)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Đang lưu..." : editId ? "Cập nhật" : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header"><span className="card-title">Xác nhận xóa</span></div>
            <div className="modal-body">
              <p style={{ color: "var(--color-text-muted)" }}>Bạn có chắc chắn muốn xóa chứng chỉ này không?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Hủy</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
