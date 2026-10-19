require("dotenv").config();
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "student_management",
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
function text(value, max = 150) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function required(value, name, max = 150) {
  const result = text(value, max);
  if (!result) {
    const error = new Error(`${name} is required.`);
    error.status = 400;
    throw error;
  }
  return result;
}
function validDate(value) {
  if (!value) return null;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
    const error = new Error("Date must be in YYYY-MM-DD format.");
    error.status = 400;
    throw error;
  }
  return s;
}
function studentInput(body) {
  const first_name = required(body.first_name, "First name", 80);
  const last_name = required(body.last_name, "Last name", 80);
  const roll_number = required(body.roll_number, "Roll number", 30);
  const class_name = required(body.class_name, "Class", 50);
  const section = text(body.section || "A", 20);
  const email = text(body.email, 150) || null;
  const phone = text(body.phone, 30) || null;
  const date_of_birth = validDate(body.date_of_birth);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("Enter a valid email address.");
    error.status = 400;
    throw error;
  }
  return { roll_number, first_name, last_name, email, phone, class_name, section, date_of_birth };
}
function positiveId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    const error = new Error("A valid ID is required.");
    error.status = 400;
    throw error;
  }
  return id;
}

app.get("/api/health", asyncRoute(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, database: "connected" });
}));

app.get("/api/dashboard", asyncRoute(async (_req, res) => {
  const [[{ totalStudents }]] = await pool.query("SELECT COUNT(*) AS totalStudents FROM students");
  const [[{ attendanceToday }]] = await pool.query(
    "SELECT COUNT(*) AS attendanceToday FROM attendance WHERE attendance_date = CURDATE()"
  );
  const [[{ presentToday }]] = await pool.query(
    "SELECT COUNT(*) AS presentToday FROM attendance WHERE attendance_date = CURDATE() AND status = 'Present'"
  );
  const [[{ averagePercentage }]] = await pool.query(
    `SELECT COALESCE(ROUND(AVG(marks_obtained / max_marks * 100), 1), 0) AS averagePercentage FROM marks`
  );
  res.json({ totalStudents, attendanceToday, presentToday, averagePercentage });
}));

app.get("/api/students", asyncRoute(async (req, res) => {
  const search = `%${text(req.query.search, 100)}%`;
  const [rows] = await pool.query(
    `SELECT s.*,
      (SELECT COUNT(*) FROM attendance a WHERE a.student_id=s.id) AS attendance_records,
      (SELECT ROUND(AVG(m.marks_obtained / m.max_marks * 100), 1) FROM marks m WHERE m.student_id=s.id) AS average_percentage
     FROM students s
     WHERE s.roll_number LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?
       OR s.class_name LIKE ? OR COALESCE(s.email, '') LIKE ?
     ORDER BY s.created_at DESC`,
    [search, search, search, search, search]
  );
  res.json(rows);
}));

app.post("/api/students", asyncRoute(async (req, res) => {
  const s = studentInput(req.body);
  const [result] = await pool.query(
    `INSERT INTO students (roll_number, first_name, last_name, email, phone, class_name, section, date_of_birth)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.roll_number, s.first_name, s.last_name, s.email, s.phone, s.class_name, s.section, s.date_of_birth]
  );
  const [rows] = await pool.query("SELECT * FROM students WHERE id=?", [result.insertId]);
  res.status(201).json(rows[0]);
}));

app.put("/api/students/:id", asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const s = studentInput(req.body);
  const [result] = await pool.query(
    `UPDATE students SET roll_number=?, first_name=?, last_name=?, email=?, phone=?,
     class_name=?, section=?, date_of_birth=? WHERE id=?`,
    [s.roll_number, s.first_name, s.last_name, s.email, s.phone, s.class_name, s.section, s.date_of_birth, id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: "Student not found." });
  const [rows] = await pool.query("SELECT * FROM students WHERE id=?", [id]);
  res.json(rows[0]);
}));

app.delete("/api/students/:id", asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const [result] = await pool.query("DELETE FROM students WHERE id=?", [id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Student not found." });
  res.json({ message: "Student and related attendance/marks deleted." });
}));

app.get("/api/attendance", asyncRoute(async (req, res) => {
  const date = req.query.date ? validDate(req.query.date) : null;
  const [rows] = await pool.query(
    `SELECT a.id, a.student_id, a.attendance_date, a.status, a.notes,
      s.roll_number, s.first_name, s.last_name, s.class_name, s.section
     FROM attendance a JOIN students s ON s.id=a.student_id
     ${date ? "WHERE a.attendance_date=?" : ""}
     ORDER BY a.attendance_date DESC, s.roll_number`,
    date ? [date] : []
  );
  res.json(rows);
}));

app.post("/api/attendance", asyncRoute(async (req, res) => {
  const student_id = positiveId(req.body.student_id);
  const attendance_date = validDate(req.body.attendance_date);
  if (!attendance_date) {
    const error = new Error("Attendance date is required."); error.status = 400; throw error;
  }
  const status = text(req.body.status, 20);
  if (!["Present", "Absent", "Late", "Excused"].includes(status)) {
    const error = new Error("Choose a valid attendance status."); error.status = 400; throw error;
  }
  const notes = text(req.body.notes, 255) || null;
  await pool.query(
    `INSERT INTO attendance (student_id, attendance_date, status, notes) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status=VALUES(status), notes=VALUES(notes)`,
    [student_id, attendance_date, status, notes]
  );
  res.status(201).json({ message: "Attendance saved." });
}));

app.delete("/api/attendance/:id", asyncRoute(async (req, res) => {
  const [result] = await pool.query("DELETE FROM attendance WHERE id=?", [positiveId(req.params.id)]);
  if (!result.affectedRows) return res.status(404).json({ error: "Attendance record not found." });
  res.json({ message: "Attendance record deleted." });
}));

app.get("/api/marks", asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.*, s.roll_number, s.first_name, s.last_name, s.class_name, s.section,
      ROUND(m.marks_obtained / m.max_marks * 100, 1) AS percentage,
      CASE WHEN m.marks_obtained / m.max_marks >= 0.9 THEN 'A+'
           WHEN m.marks_obtained / m.max_marks >= 0.8 THEN 'A'
           WHEN m.marks_obtained / m.max_marks >= 0.7 THEN 'B'
           WHEN m.marks_obtained / m.max_marks >= 0.6 THEN 'C'
           WHEN m.marks_obtained / m.max_marks >= 0.5 THEN 'D'
           ELSE 'F' END AS grade
     FROM marks m JOIN students s ON s.id=m.student_id
     ORDER BY m.created_at DESC`
  );
  res.json(rows);
}));

app.post("/api/marks", asyncRoute(async (req, res) => {
  const student_id = positiveId(req.body.student_id);
  const subject = required(req.body.subject, "Subject", 100);
  const exam_name = required(req.body.exam_name || "Final Exam", "Exam name", 100);
  const marks_obtained = Number(req.body.marks_obtained);
  const max_marks = Number(req.body.max_marks);
  if (!Number.isFinite(marks_obtained) || !Number.isFinite(max_marks) ||
      max_marks <= 0 || marks_obtained < 0 || marks_obtained > max_marks) {
    const error = new Error("Marks must be between 0 and the maximum marks, which must be greater than 0.");
    error.status = 400; throw error;
  }
  await pool.query(
    `INSERT INTO marks (student_id, subject, exam_name, marks_obtained, max_marks)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE marks_obtained=VALUES(marks_obtained), max_marks=VALUES(max_marks)`,
    [student_id, subject, exam_name, marks_obtained, max_marks]
  );
  res.status(201).json({ message: "Marks saved. Existing subject/exam entries are updated." });
}));

app.delete("/api/marks/:id", asyncRoute(async (req, res) => {
  const [result] = await pool.query("DELETE FROM marks WHERE id=?", [positiveId(req.params.id)]);
  if (!result.affectedRows) return res.status(404).json({ error: "Mark record not found." });
  res.json({ message: "Mark record deleted." });
}));

app.get("/api/results", asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id, s.roll_number, s.first_name, s.last_name, s.class_name, s.section,
      COUNT(m.id) AS subjects,
      COALESCE(SUM(m.marks_obtained), 0) AS total_marks,
      COALESCE(SUM(m.max_marks), 0) AS total_max_marks,
      COALESCE(ROUND(SUM(m.marks_obtained) / NULLIF(SUM(m.max_marks), 0) * 100, 1), 0) AS percentage,
      CASE WHEN COUNT(m.id)=0 THEN 'No marks'
           WHEN SUM(m.marks_obtained) / SUM(m.max_marks) >= 0.9 THEN 'A+'
           WHEN SUM(m.marks_obtained) / SUM(m.max_marks) >= 0.8 THEN 'A'
           WHEN SUM(m.marks_obtained) / SUM(m.max_marks) >= 0.7 THEN 'B'
           WHEN SUM(m.marks_obtained) / SUM(m.max_marks) >= 0.6 THEN 'C'
           WHEN SUM(m.marks_obtained) / SUM(m.max_marks) >= 0.5 THEN 'D'
           ELSE 'F' END AS grade,
      CASE WHEN COUNT(m.id)=0 THEN 'Pending'
           WHEN SUM(m.marks_obtained) / SUM(m.max_marks) >= 0.35 THEN 'Pass'
           ELSE 'Fail' END AS result_status
     FROM students s LEFT JOIN marks m ON m.student_id=s.id
     GROUP BY s.id ORDER BY s.class_name, s.roll_number`
  );
  res.json(rows);
}));

app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "That roll number, email, or student/subject/exam entry already exists." });
  }
  if (err.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({ error: "Selected student does not exist." });
  }
  res.status(err.status || 500).json({ error: err.status ? err.message : "Server error. Check server logs and database settings." });
});

app.listen(PORT, () => console.log(`Student Management System running at http://localhost:${PORT}`));
