"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const Icons = {
  users: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  check: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  pause: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ban: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  search: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  plus: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
};

type Employee = {
  id: string;
  name: string;
  employee_code: string;
  department: string | null;
  position: string | null;
  work_unit: string | null;
  status: "active" | "inactive" | "on-leave";
  email: string | null;
  phone: string | null;
  join_date: string | null;
};

const DEPARTMENTS = ["Phòng Kỹ thuật Công nghệ", "Trung tâm KV1", "Trung tâm KV2", "Trung tâm KV3", "Trung tâm Đo lường và tối ưu toàn cầu", "Phòng Chiến lược Kinh doanh", "Trung tâm tư vấn Dân dụng và Công nghiệp", "Phòng Đầu tư", "Trung tâm Giải pháp hạ tầng viễn thông"];
const STATUS_LABELS: Record<string, string> = { active: "Đang làm", inactive: "Nghỉ việc", "on-leave": "Nghỉ phép" };
const STATUS_BADGE: Record<string, string> = { active: "badge badge-green", inactive: "badge badge-red", "on-leave": "badge badge-yellow" };

const AVATAR_COLORS = ["#2563eb","#0891b2","#059669","#d97706","#dc2626"];
const getColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) => name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();

type FormState = { name: string; employee_code: string; department: string; position: string; email: string; phone: string; status: string; };
const EMPTY_FORM: FormState = { name: "", employee_code: "", department: "", position: "", email: "", phone: "", status: "active" };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>("/api/employees");
      setEmployees(data);
    } finally { setLoading(false); }
  };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_code.includes(search) ||
    (e.department || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true); };
  const openEdit = (emp: Employee) => {
    setForm({ name: emp.name, employee_code: emp.employee_code, department: emp.department || "", position: emp.position || "", email: emp.email || "", phone: emp.phone || "", status: emp.status });
    setEditId(emp.id);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await apiRequest(`/api/employees/${editId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiRequest("/api/employees", { method: "POST", body: JSON.stringify(form) });
      }
      setShowModal(false);
      fetchEmployees();
    } catch (err: any) {
      alert("Đã có lỗi xảy ra: " + err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await apiRequest(`/api/employees/${id}`, { method: "DELETE" });
    setDeleteId(null);
    fetchEmployees();
  };

  const counts = {
    active: employees.filter(e => e.status === "active").length,
    inactive: employees.filter(e => e.status === "inactive").length,
    leave: employees.filter(e => e.status === "on-leave").length,
  };

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Quản lý Nhân sự</div>
          <div className="topbar-subtitle">{employees.length} nhân viên trong hệ thống</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <span style={{ width: 16, height: 16 }}>{Icons.plus}</span> Thêm nhân viên
        </button>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#f1f5f9", color: "#475569" }}>{Icons.users}</div>
            <div>
              <div className="stat-value">{employees.length}</div>
              <div className="stat-label">Tổng nhân viên</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>{Icons.check}</div>
            <div>
              <div className="stat-value">{counts.active}</div>
              <div className="stat-label">Đang làm việc</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}>{Icons.pause}</div>
            <div>
              <div className="stat-value">{counts.leave}</div>
              <div className="stat-label">Nghỉ phép</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>{Icons.ban}</div>
            <div>
              <div className="stat-value">{counts.inactive}</div>
              <div className="stat-label">Nghỉ việc</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Danh sách nhân viên</span>
            <div className="search-wrapper">
              <span className="search-icon">{Icons.search}</span>
              <input
                className="search-input"
                placeholder="Tìm kiếm..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>Đang tải...</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Phòng ban</th>
                    <th>Vị trí</th>
                    <th>Liên hệ</th>
                    <th>Ngày vào</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div className="avatar" style={{ background: getColor(emp.name) }}>
                            {getInitials(emp.name)}
                          </div>
                          <div>
                            <div className="table-name">{emp.name}</div>
                            <div className="table-sub">{emp.employee_code}</div>
                          </div>
                        </div>
                      </td>
                      <td>{emp.department || <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
                      <td>{emp.position || <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
                      <td>
                        <div className="table-sub" style={{ color: "var(--color-text)" }}>{emp.email || "—"}</div>
                        <div className="table-sub">{emp.phone || ""}</div>
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                        {emp.join_date ? new Date(emp.join_date).toLocaleDateString("vi-VN") : "—"}
                      </td>
                      <td>
                        <span className={STATUS_BADGE[emp.status] || "badge badge-gray"}>
                          {STATUS_LABELS[emp.status] || emp.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(emp)}>Sửa</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(emp.id)}>Xóa</button>
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
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="card-title">{editId ? "Cập nhật nhân viên" : "Thêm nhân viên mới"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Mã nhân viên *</label>
                    <input className="form-input" placeholder="VD: 123456" value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Họ và tên *</label>
                    <input className="form-input" placeholder="Nguyễn Văn A" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phòng ban</label>
                    <select className="form-select" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                      <option value="">-- Chọn phòng ban --</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vị trí</label>
                    <input className="form-input" placeholder="Kỹ sư thiết kế" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" placeholder="example@viettel.com.vn" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số điện thoại</label>
                    <input className="form-input" placeholder="09xxxxxxxx" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Trạng thái</label>
                    <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="active">Đang làm việc</option>
                      <option value="on-leave">Nghỉ phép</option>
                      <option value="inactive">Nghỉ việc</option>
                    </select>
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
            <div className="modal-header">
              <span className="card-title">Xác nhận xóa</span>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--color-text-muted)" }}>Bạn có chắc chắn muốn xóa nhân viên này? Hành động này không thể hoàn tác.</p>
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
