"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

const Icons = {
  briefcase: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  users: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  search: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  plus: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  back: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  chevron: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>,
  pencil: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  trash: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
};

type ProjectAssignment = {
  id: string;
  employee_id: string;
  contract_id: string | null;
  position: string | null;
  start_date: string | null;
  end_date: string | null;
  project_name: string | null;
  company_size: string | null;
  description: string | null;
  created_at?: string;
  employees?: { name: string; employee_code: string };
};

type ProjectGroup = {
  project_name: string;
  company_size: string | null;
  start_date: string | null;
  end_date: string | null;
  latest_created_at: number;
  assignments: ProjectAssignment[];
};

type Employee = { id: string; name: string; employee_code: string };
type AssignForm = { employee_id: string; project_name: string; position: string; start_date: string; end_date: string; company_size: string };
type ProjectForm = { project_name: string; company_size: string; start_date: string; end_date: string; employee_id: string; position: string };

const EMPTY_ASSIGN: AssignForm = { employee_id: "", project_name: "", position: "", start_date: "", end_date: "", company_size: "" };
const EMPTY_PROJECT: ProjectForm = { project_name: "", company_size: "", start_date: "", end_date: "", employee_id: "", position: "" };

export default function ProjectAssignmentsPage() {
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState<AssignForm>(EMPTY_ASSIGN);
  const [editAssignId, setEditAssignId] = useState<string | null>(null);
  const [savingAssign, setSavingAssign] = useState(false);
  const [deleteAssignId, setDeleteAssignId] = useState<string | null>(null);

  // Project modal
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectForm>(EMPTY_PROJECT);
  const [editProjectName, setEditProjectName] = useState<string | null>(null); // original name before edit
  const [savingProject, setSavingProject] = useState(false);
  const [deleteProjectName, setDeleteProjectName] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [asgData, empData] = await Promise.all([
        apiRequest<ProjectAssignment[]>("/api/project-assignments"),
        apiRequest<Employee[]>("/api/employees"),
      ]);
      setAssignments(asgData);
      setEmployees(empData);
    } finally { setLoading(false); }
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

  // Group by project_name
  const groupedObj = assignments.reduce((acc, a) => {
    const key = a.project_name || "(Chưa có tên)";
    const createdTs = a.created_at ? new Date(a.created_at).getTime() : 0;
    if (!acc[key]) {
      acc[key] = { project_name: key, company_size: a.company_size, start_date: a.start_date, end_date: a.end_date, assignments: [], latest_created_at: createdTs };
    }
    acc[key].assignments.push(a);
    if (createdTs > acc[key].latest_created_at) acc[key].latest_created_at = createdTs;
    return acc;
  }, {} as Record<string, ProjectGroup>);

  // Sort groups by latest assignment descending
  const projectGroups: ProjectGroup[] = Object.values(groupedObj).sort((a, b) => b.latest_created_at - a.latest_created_at);

  const filteredProjects = projectGroups.filter(p =>
    p.project_name.toLowerCase().includes(search.toLowerCase())
  );
  useEffect(() => { setCurrentPage(1); }, [search]);
  const totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE);
  const currentProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectedGroup = selectedProject ? projectGroups.find(p => p.project_name === selectedProject) ?? null : null;

  // ── Assignment CRUD ──────────────────────────────────
  const openAddAssign = (projectName?: string) => {
    setAssignForm({ 
      ...EMPTY_ASSIGN, 
      project_name: projectName || selectedProject || "",
      start_date: selectedGroup?.start_date ? selectedGroup.start_date.substring(0, 10) : "",
      end_date: selectedGroup?.end_date ? selectedGroup.end_date.substring(0, 10) : "",
    });
    setEditAssignId(null);
    setShowAssignModal(true);
  };

  const openEditAssign = (a: ProjectAssignment) => {
    setAssignForm({
      employee_id: a.employee_id,
      project_name: a.project_name || "",
      position: a.position || "",
      start_date: a.start_date ? a.start_date.substring(0, 10) : "",
      end_date: a.end_date ? a.end_date.substring(0, 10) : "",
      company_size: a.company_size || "",
    });
    setEditAssignId(a.id);
    setShowAssignModal(true);
  };

  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAssign(true);
    try {
      if (editAssignId) {
        await apiRequest(`/api/project-assignments/${editAssignId}`, { method: "PUT", body: JSON.stringify(assignForm) });
      } else {
        await apiRequest("/api/project-assignments", { method: "POST", body: JSON.stringify(assignForm) });
      }
      setShowAssignModal(false);
      await fetchData();
    } catch (err: any) {
      alert("Đã có lỗi: " + err.message);
    } finally { setSavingAssign(false); }
  };

  const handleDeleteAssign = async () => {
    if (!deleteAssignId) return;
    await apiRequest(`/api/project-assignments/${deleteAssignId}`, { method: "DELETE" });
    setDeleteAssignId(null);
    await fetchData();
    // Go back if project is now empty
    if (selectedProject) {
      const remaining = assignments.filter(a => a.id !== deleteAssignId && a.project_name === selectedProject);
      if (remaining.length === 0) setSelectedProject(null);
    }
  };

  // ── Project CRUD ──────────────────────────────────────
  const openAddProject = () => {
    setProjectForm(EMPTY_PROJECT);
    setEditProjectName(null);
    setShowProjectModal(true);
  };

  const openEditProject = (p: ProjectGroup, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setProjectForm({
      project_name: p.project_name,
      company_size: p.company_size || "",
      start_date: p.start_date ? p.start_date.substring(0, 10) : "",
      end_date: p.end_date ? p.end_date.substring(0, 10) : "",
      employee_id: "",
      position: "",
    });
    setEditProjectName(p.project_name);
    setShowProjectModal(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProject(true);
    try {
      if (editProjectName) {
        // Update all assignments that belong to this project
        const group = projectGroups.find(p => p.project_name === editProjectName);
        if (group) {
          await Promise.all(group.assignments.map(a =>
            apiRequest(`/api/project-assignments/${a.id}`, {
              method: "PUT",
              body: JSON.stringify({
                employee_id: a.employee_id,
                project_name: projectForm.project_name,
                position: a.position,
                company_size: projectForm.company_size || a.company_size,
                start_date: projectForm.start_date || a.start_date?.substring(0, 10) || "",
                end_date: projectForm.end_date || a.end_date?.substring(0, 10) || "",
              }),
            })
          ));
          // Update selected project name if we were viewing it
          if (selectedProject === editProjectName) {
            setSelectedProject(projectForm.project_name);
          }
        }
      } else {
        // Create a new project = actually create the first assignment
        await apiRequest("/api/project-assignments", { 
          method: "POST", 
          body: JSON.stringify({
            employee_id: projectForm.employee_id,
            project_name: projectForm.project_name,
            position: projectForm.position,
            company_size: projectForm.company_size,
            start_date: projectForm.start_date,
            end_date: projectForm.end_date,
          }) 
        });
      }
      setShowProjectModal(false);
      await fetchData();
    } catch (err: any) {
      alert("Đã có lỗi: " + err.message);
    } finally { setSavingProject(false); }
  };

  const handleDeleteProject = async () => {
    if (!deleteProjectName) return;
    const group = projectGroups.find(p => p.project_name === deleteProjectName);
    if (group) {
      await Promise.all(group.assignments.map(a =>
        apiRequest(`/api/project-assignments/${a.id}`, { method: "DELETE" })
      ));
    }
    setDeleteProjectName(null);
    if (selectedProject === deleteProjectName) setSelectedProject(null);
    await fetchData();
  };

  // ── RENDER ────────────────────────────────────────────
  return (
    <>
      {/* ── TOPBAR ── */}
      {selectedProject && selectedGroup ? (
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn btn-ghost" style={{ padding: "6px 10px" }} onClick={() => setSelectedProject(null)}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{Icons.back}</span>
            </button>
            <div>
              <div className="topbar-title" style={{ maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedGroup.project_name}
              </div>
              <div className="topbar-subtitle">{selectedGroup.assignments.length} nhân sự được phân công</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => openEditProject(selectedGroup)}>
              <span style={{ width: 16, height: 16, display: "flex" }}>{Icons.pencil}</span> Sửa dự án
            </button>
            <button className="btn btn-danger" style={{ fontWeight: 500 }} onClick={() => setDeleteProjectName(selectedGroup.project_name)}>
              <span style={{ width: 16, height: 16, display: "flex" }}>{Icons.trash}</span> Xóa dự án
            </button>
            <button className="btn btn-primary" onClick={() => openAddAssign()}>
              <span style={{ width: 16, height: 16, display: "flex" }}>{Icons.plus}</span> Thêm nhân sự
            </button>
          </div>
        </div>
      ) : (
        <div className="topbar">
          <div>
            <div className="topbar-title">Phân công dự án</div>
            <div className="topbar-subtitle">{projectGroups.length} dự án · {assignments.length} phân công</div>
          </div>
          <button className="btn btn-primary" onClick={openAddProject}>
            <span style={{ width: 16, height: 16, display: "flex" }}>{Icons.plus}</span> Thêm dự án mới
          </button>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div className="page-content">
        {selectedProject && selectedGroup ? (
          /* Detail View */
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#eff6ff", color: "#3b82f6" }}>{Icons.users}</div>
                <div><div className="stat-value">{selectedGroup.assignments.length}</div><div className="stat-label">Nhân sự</div></div>
              </div>
              {selectedGroup.company_size && selectedGroup.company_size !== "0" && (
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>{Icons.briefcase}</div>
                  <div><div className="stat-value" style={{ fontSize: 16 }}>{selectedGroup.company_size}</div><div className="stat-label">Quy mô</div></div>
                </div>
              )}
              {selectedGroup.start_date && (
                <div className="stat-card">
                  <div style={{ flex: 1 }}>
                    <div className="stat-label">Thời gian</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", marginTop: 4 }}>
                      {fmtDate(selectedGroup.start_date)} → {fmtDate(selectedGroup.end_date)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Nhân sự được phân công</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nhân sự</th>
                      <th>Vị trí tham gia</th>
                      <th>Thời gian</th>
                      <th style={{ textAlign: "right" }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGroup.assignments.map(a => (
                      <tr key={a.id}>
                        <td>
                          <div className="table-name">{a.employees?.name || "—"}</div>
                          <div className="table-sub">{a.employees?.employee_code}</div>
                        </td>
                        <td>{a.position || "—"}</td>
                        <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                          {fmtDate(a.start_date)}{a.end_date && <> → {fmtDate(a.end_date)}</>}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEditAssign(a)}>Sửa</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setDeleteAssignId(a.id)}>Xóa</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* Master View */
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#eff6ff", color: "#3b82f6" }}>{Icons.briefcase}</div>
                <div><div className="stat-value">{projectGroups.length}</div><div className="stat-label">Dự án</div></div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>{Icons.users}</div>
                <div><div className="stat-value">{assignments.length}</div><div className="stat-label">Tổng phân công</div></div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Danh sách dự án</span>
                <div className="filters">
                  <div className="search-wrapper">
                    <span className="search-icon">{Icons.search}</span>
                    <input className="search-input" placeholder="Tìm kiếm dự án..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
              </div>

              {loading ? (
                <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>Đang tải...</div>
              ) : (
                <div>
                  {currentProjects.map((p, idx) => (
                    <div
                      key={p.project_name}
                      style={{
                        display: "flex", alignItems: "center", padding: "14px 20px",
                        borderBottom: idx < currentProjects.length - 1 ? "1px solid var(--color-border)" : "none",
                        cursor: "pointer", transition: "background 0.15s", gap: 14,
                      }}
                      onClick={() => setSelectedProject(p.project_name)}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#eff6ff", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 20, height: 20, strokeWidth: 2 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.project_name}
                        </div>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                            <span style={{ fontWeight: 600, color: "#3b82f6" }}>{p.assignments.length}</span> nhân sự
                          </span>
                          {p.company_size && p.company_size !== "0" && (
                            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Quy mô: {p.company_size}</span>
                          )}
                          {p.start_date && (
                            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                              {fmtDate(p.start_date)}{p.end_date && ` → ${fmtDate(p.end_date)}`}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm" title="Sửa dự án" onClick={(e) => openEditProject(p, e)}>
                          <span style={{ width: 14, height: 14, display: "flex" }}>{Icons.pencil}</span>
                        </button>
                        <button className="btn btn-danger btn-sm" title="Xóa dự án" onClick={(e) => { e.stopPropagation(); setDeleteProjectName(p.project_name); }}>
                          <span style={{ width: 14, height: 14, display: "flex" }}>{Icons.trash}</span>
                        </button>
                      </div>
                      <div style={{ color: "var(--color-text-muted)", flexShrink: 0, width: 18, height: 18 }}>{Icons.chevron}</div>
                    </div>
                  ))}
                  {filteredProjects.length === 0 && (
                    <div style={{ padding: 48, textAlign: "center", color: "var(--color-text-muted)" }}>Không tìm thấy dự án</div>
                  )}
                </div>
              )}

              {!loading && totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderTop: "1px solid var(--color-border)" }}>
                  <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
                    Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredProjects.length)} trong {filteredProjects.length} dự án
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Trước</button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                      <button key={p} className={`btn btn-sm ${currentPage === p ? "btn-primary" : "btn-ghost"}`} onClick={() => setCurrentPage(p)} style={currentPage === p ? {} : { fontWeight: 400 }}>{p}</button>
                    ))}
                    <button className="btn btn-ghost btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Sau</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── ASSIGNMENT MODAL ── */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{editAssignId ? "Sửa phân công nhân sự" : "Thêm nhân sự vào dự án"}</h3>
              <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setShowAssignModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="assignForm" onSubmit={handleSaveAssign} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Nhân sự *</label>
                  <select className="form-select" value={assignForm.employee_id} onChange={e => setAssignForm({ ...assignForm, employee_id: e.target.value })} required>
                    <option value="">-- Chọn nhân sự --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.employee_code}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tên dự án *</label>
                  <input className="form-input" value={assignForm.project_name} disabled required style={{ background: "#f1f5f9", cursor: "not-allowed" }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Vị trí tham gia</label>
                  <input className="form-input" placeholder="VD: Backend Developer" value={assignForm.position} onChange={e => setAssignForm({ ...assignForm, position: e.target.value })} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Từ ngày</label>
                    <input type="date" className="form-input" value={assignForm.start_date} onChange={e => setAssignForm({ ...assignForm, start_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Đến ngày</label>
                    <input type="date" className="form-input" value={assignForm.end_date} onChange={e => setAssignForm({ ...assignForm, end_date: e.target.value })} />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" type="button" onClick={() => setShowAssignModal(false)}>Hủy</button>
              <button className="btn btn-primary" form="assignForm" type="submit" disabled={savingAssign}>{savingAssign ? "Đang lưu..." : "Lưu"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROJECT MODAL ── */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{editProjectName ? "Sửa thông tin dự án" : "Thêm dự án mới"}</h3>
              <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setShowProjectModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="projectForm" onSubmit={handleSaveProject} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Tên dự án *</label>
                  <input className="form-input" placeholder="VD: Đầu tư xây dựng hạ tầng..." value={projectForm.project_name} onChange={e => setProjectForm({ ...projectForm, project_name: e.target.value })} required />
                </div>
                {!editProjectName && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Nhân sự tham gia (Bắt buộc) *</label>
                      <select className="form-select" value={projectForm.employee_id} onChange={e => setProjectForm({ ...projectForm, employee_id: e.target.value })} required>
                        <option value="">-- Chọn nhân sự đầu tiên --</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.employee_code}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Vị trí tham gia</label>
                      <input className="form-input" placeholder="VD: Backend Developer" value={projectForm.position} onChange={e => setProjectForm({ ...projectForm, position: e.target.value })} />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label className="form-label">Quy mô</label>
                  <input className="form-input" placeholder="VD: Lớn, Nhỏ, 50 người..." value={projectForm.company_size} onChange={e => setProjectForm({ ...projectForm, company_size: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Từ ngày</label>
                    <input type="date" className="form-input" value={projectForm.start_date} onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Đến ngày</label>
                    <input type="date" className="form-input" value={projectForm.end_date} onChange={e => setProjectForm({ ...projectForm, end_date: e.target.value })} />
                  </div>
                </div>
                {editProjectName && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
                    ⚠️ Thay đổi tên dự án sẽ cập nhật toàn bộ phân công thuộc dự án này.
                  </div>
                )}
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" type="button" onClick={() => setShowProjectModal(false)}>Hủy</button>
              <button className="btn btn-primary" form="projectForm" type="submit" disabled={savingProject}>{savingProject ? "Đang lưu..." : "Lưu dự án"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE ASSIGNMENT MODAL ── */}
      {deleteAssignId && (
        <div className="modal-overlay" onClick={() => setDeleteAssignId(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Xác nhận xóa phân công</h3>
            </div>
            <div className="modal-body">Bạn có chắc chắn muốn xóa phân công này? Hành động không thể hoàn tác.</div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteAssignId(null)}>Hủy</button>
              <button className="btn btn-danger" onClick={handleDeleteAssign}>Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE PROJECT MODAL ── */}
      {deleteProjectName && (
        <div className="modal-overlay" onClick={() => setDeleteProjectName(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Xác nhận xóa dự án</h3>
            </div>
            <div className="modal-body">
              <p>Bạn có chắc chắn muốn xóa dự án <strong>"{deleteProjectName}"</strong>?</p>
              <p style={{ marginTop: 8, color: "#dc2626", fontSize: 13 }}>
                ⚠️ Toàn bộ {projectGroups.find(p => p.project_name === deleteProjectName)?.assignments.length || 0} phân công nhân sự thuộc dự án này sẽ bị xóa vĩnh viễn.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteProjectName(null)}>Hủy</button>
              <button className="btn btn-danger" onClick={handleDeleteProject}>Xóa dự án</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
