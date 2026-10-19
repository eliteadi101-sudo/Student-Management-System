const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { students: [], results: [], toastTimer: null };

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function initials(s) {
  return `${(s.first_name || "?")[0]}${(s.last_name || "")[0] || ""}`.toUpperCase();
}
function fullName(s) { return `${s.first_name || ""} ${s.last_name || ""}`.trim(); }
function fmtDate(date) {
  if (!date) return "—";
  const d = new Date(`${String(date).slice(0,10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? esc(date) : d.toLocaleDateString(undefined, {day:"numeric",month:"short",year:"numeric"});
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? {"Content-Type":"application/json"} : {}), ...(options.headers || {}) }
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}
function statusPill(status) {
  const cls = String(status || "").toLowerCase().replace(/[^a-z]/g, "");
  return `<span class="pill ${esc(cls)}">${esc(status || "—")}</span>`;
}
function emptyRow(cols, message) {
  return `<tr><td colspan="${cols}"><div class="empty">${esc(message)}</div></td></tr>`;
}
function studentCell(s) {
  return `<div class="person"><span class="person-avatar">${esc(initials(s))}</span><span><strong>${esc(fullName(s))}</strong><small>${esc(s.email || "No email provided")}</small></span></div>`;
}
function studentTable(rows, withActions = true) {
  return `<table><thead><tr><th>Student</th><th>Roll number</th><th>Class</th><th>Section</th><th>Attendance</th><th>Average</th>${withActions ? "<th>Actions</th>" : ""}</tr></thead><tbody>${
    rows.length ? rows.map(s => `<tr><td>${studentCell(s)}</td><td>${esc(s.roll_number)}</td><td>${esc(s.class_name)}</td><td>${esc(s.section || "—")}</td><td>${Number(s.attendance_records || 0)}</td><td>${s.average_percentage == null ? "—" : `${esc(s.average_percentage)}%`}</td>${withActions ? `<td><div class="actions"><button class="small-btn" data-edit="${s.id}">Edit</button><button class="small-btn danger" data-delete-student="${s.id}">Delete</button></div></td>` : ""}</tr>`).join("") : emptyRow(withActions ? 7 : 6, "No students found. Add a student to get started.")}</tbody></table>`;
}
function navigate(view) {
  $$(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
  $$(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  const titles = {dashboard:"Dashboard",students:"Students",attendance:"Attendance",marks:"Marks",results:"Results"};
  $("#page-title").textContent = titles[view] || "Dashboard";
  if (view === "dashboard") loadDashboard();
  if (view === "students") loadStudents();
  if (view === "attendance") loadAttendance();
  if (view === "marks") loadMarks();
  if (view === "results") loadResults();
}
async function loadDashboard() {
  try {
    const [stats, students] = await Promise.all([api("/api/dashboard"), api("/api/students")]);
    $("#stat-students").textContent = stats.totalStudents;
    $("#stat-attendance").textContent = stats.attendanceToday;
    $("#stat-present").textContent = stats.presentToday;
    $("#stat-average").textContent = `${stats.averagePercentage}%`;
    $("#stat-attendance-sub").textContent = `${stats.attendanceToday} record${stats.attendanceToday === 1 ? "" : "s"} submitted today`;
    $("#recent-students").innerHTML = studentTable(students.slice(0,5), false);
    state.students = students;
  } catch (e) { showToast(e.message, true); }
}
async function loadStudents() {
  try {
    const query = encodeURIComponent($("#student-search").value.trim());
    const students = await api(`/api/students?search=${query}`);
    state.students = students;
    $("#students-table").innerHTML = studentTable(students);
    $("#student-count").textContent = `${students.length} student${students.length === 1 ? "" : "s"}`;
    updateStudentOptions();
  } catch (e) { showToast(e.message, true); }
}
function updateStudentOptions() {
  const options = state.students.map(s => `<option value="${s.id}">${esc(s.roll_number)} — ${esc(fullName(s))}</option>`).join("");
  ["#attendance-student", "#marks-student"].forEach(sel => {
    const select = $(sel), old = select.value;
    select.innerHTML = `<option value="">Choose a student</option>${options}`;
    if (old && state.students.some(s => String(s.id) === old)) select.value = old;
  });
}
function openStudentDialog(student = null) {
  const form = $("#student-form");
  form.reset();
  form.elements.id.value = student?.id || "";
  $("#student-dialog-title").textContent = student ? "Edit student" : "Add student";
  if (student) {
    for (const key of ["roll_number","first_name","last_name","email","phone","class_name","section","date_of_birth"]) {
      form.elements[key].value = student[key] || "";
    }
  } else form.elements.section.value = "A";
  $("#student-dialog").showModal();
}
async function saveStudent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.elements.id.value;
  const body = Object.fromEntries(new FormData(form).entries());
  delete body.id;
  try {
    await api(id ? `/api/students/${id}` : "/api/students", {method:id ? "PUT" : "POST", body:JSON.stringify(body)});
    $("#student-dialog").close();
    showToast(id ? "Student updated successfully." : "Student added successfully.");
    await Promise.all([loadStudents(), loadDashboard()]);
  } catch (e) { showToast(e.message, true); }
}
async function deleteStudent(id) {
  const student = state.students.find(s => String(s.id) === String(id));
  if (!confirm(`Delete ${student ? fullName(student) : "this student"}? Their attendance and marks will also be deleted.`)) return;
  try {
    await api(`/api/students/${id}`, {method:"DELETE"});
    showToast("Student deleted.");
    await Promise.all([loadStudents(), loadDashboard()]);
  } catch (e) { showToast(e.message, true); }
}
async function loadAttendance() {
  try {
    const date = $("#attendance-filter").value;
    const rows = await api(`/api/attendance${date ? `?date=${encodeURIComponent(date)}` : ""}`);
    $("#attendance-table").innerHTML = `<table><thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead><tbody>${rows.length ? rows.map(a => `<tr><td>${fmtDate(a.attendance_date)}</td><td>${studentCell(a)}</td><td>${esc(a.class_name)} / ${esc(a.section || "—")}</td><td>${statusPill(a.status)}</td><td>${esc(a.notes || "—")}</td><td><button class="small-btn danger" data-delete-attendance="${a.id}">Delete</button></td></tr>`).join("") : emptyRow(6, "No attendance records for this date.")}</tbody></table>`;
  } catch (e) { showToast(e.message, true); }
}
async function saveAttendance(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await api("/api/attendance", {method:"POST",body:JSON.stringify(body)});
    showToast("Attendance saved.");
    await Promise.all([loadAttendance(), loadDashboard()]);
  } catch (e) { showToast(e.message, true); }
}
async function deleteAttendance(id) {
  if (!confirm("Delete this attendance record?")) return;
  try { await api(`/api/attendance/${id}`,{method:"DELETE"}); showToast("Attendance record deleted."); await Promise.all([loadAttendance(),loadDashboard()]); }
  catch(e) { showToast(e.message,true); }
}
async function loadMarks() {
  try {
    const rows = await api("/api/marks");
    $("#marks-table").innerHTML = `<table><thead><tr><th>Student</th><th>Subject</th><th>Exam</th><th>Score</th><th>Percentage</th><th>Grade</th><th>Action</th></tr></thead><tbody>${rows.length ? rows.map(m => `<tr><td>${studentCell(m)}</td><td>${esc(m.subject)}</td><td>${esc(m.exam_name)}</td><td>${esc(m.marks_obtained)} / ${esc(m.max_marks)}</td><td>${esc(m.percentage)}%</td><td>${statusPill(m.grade)}</td><td><button class="small-btn danger" data-delete-mark="${m.id}">Delete</button></td></tr>`).join("") : emptyRow(7, "No marks entered yet.")}</tbody></table>`;
  } catch(e) { showToast(e.message,true); }
}
async function saveMarks(event) {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await api("/api/marks",{method:"POST",body:JSON.stringify(body)});
    showToast("Marks saved. Results have been recalculated.");
    await Promise.all([loadMarks(),loadResults(),loadDashboard()]);
  } catch(e) { showToast(e.message,true); }
}
async function deleteMark(id) {
  if (!confirm("Delete this mark entry?")) return;
  try { await api(`/api/marks/${id}`,{method:"DELETE"}); showToast("Mark entry deleted."); await Promise.all([loadMarks(),loadResults(),loadDashboard()]); }
  catch(e) { showToast(e.message,true); }
}
async function loadResults() {
  try {
    state.results = await api("/api/results");
    renderResults();
  } catch(e) { showToast(e.message,true); }
}
function renderResults() {
  const query = $("#results-search").value.trim().toLowerCase();
  const rows = state.results.filter(r => [r.roll_number,fullName(r),r.class_name,r.section,r.grade,r.result_status].some(v => String(v ?? "").toLowerCase().includes(query)));
  $("#results-count").textContent = `${rows.length} result${rows.length === 1 ? "" : "s"}`;
  $("#results-table").innerHTML = `<table><thead><tr><th>Roll number</th><th>Student</th><th>Class</th><th>Subjects</th><th>Total</th><th>Percentage</th><th>Grade</th><th>Result</th></tr></thead><tbody>${rows.length ? rows.map(r => `<tr><td>${esc(r.roll_number)}</td><td>${studentCell(r)}</td><td>${esc(r.class_name)} / ${esc(r.section || "—")}</td><td>${esc(r.subjects)}</td><td>${Number(r.subjects) ? `${esc(Number(r.total_marks))} / ${esc(Number(r.total_max_marks))}` : "—"}</td><td>${Number(r.subjects) ? `${esc(r.percentage)}%` : "—"}</td><td>${statusPill(r.grade)}</td><td>${statusPill(r.result_status)}</td></tr>`).join("") : emptyRow(8, "No results match your search.")}</tbody></table>`;
}
function exportResults() {
  if (!state.results.length) return showToast("No results to export.", true);
  const columns = ["roll_number","first_name","last_name","class_name","section","subjects","total_marks","total_max_marks","percentage","grade","result_status"];
  const csvCell = value => `"${String(value ?? "").replace(/"/g,'""')}"`;
  const csv = [columns.join(","), ...state.results.map(r => columns.map(c => csvCell(r[c])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = "student-results.csv"; a.click(); URL.revokeObjectURL(url);
  showToast("Results exported to CSV.");
}

$$(".nav-item").forEach(button => button.addEventListener("click", () => navigate(button.dataset.view)));
$$("[data-go]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.go)));
$("#quick-add").addEventListener("click", () => openStudentDialog());
$("#add-student").addEventListener("click", () => openStudentDialog());
$("#close-dialog").addEventListener("click", () => $("#student-dialog").close());
$("#cancel-dialog").addEventListener("click", () => $("#student-dialog").close());
$("#student-form").addEventListener("submit", saveStudent);
$("#attendance-form").addEventListener("submit", saveAttendance);
$("#marks-form").addEventListener("submit", saveMarks);
$("#student-search").addEventListener("input", loadStudents);
$("#attendance-filter").addEventListener("change", loadAttendance);
$("#results-search").addEventListener("input", renderResults);
$("#export-results").addEventListener("click", exportResults);
document.addEventListener("click", event => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.edit) {
    const student = state.students.find(s => String(s.id) === target.dataset.edit);
    if (student) openStudentDialog(student);
  }
  if (target.dataset.deleteStudent) deleteStudent(target.dataset.deleteStudent);
  if (target.dataset.deleteAttendance) deleteAttendance(target.dataset.deleteAttendance);
  if (target.dataset.deleteMark) deleteMark(target.dataset.deleteMark);
});

$("#today-label").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"});
$("#attendance-date").value = todayISO();
$("#attendance-filter").value = todayISO();

async function init() {
  try {
    await api("/api/health");
    await loadStudents();
    await Promise.all([loadDashboard(),loadAttendance(),loadMarks(),loadResults()]);
  } catch (e) {
    showToast("Cannot connect to the server/database. Follow the README setup steps.", true);
    console.error(e);
  }
}
init();
