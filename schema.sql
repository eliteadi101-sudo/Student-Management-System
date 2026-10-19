CREATE DATABASE IF NOT EXISTS student_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE student_management;

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roll_number VARCHAR(30) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(30),
  class_name VARCHAR(50) NOT NULL,
  section VARCHAR(20) DEFAULT 'A',
  date_of_birth DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  status ENUM('Present', 'Absent', 'Late', 'Excused') NOT NULL,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_student_day (student_id, attendance_date),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id)
    REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject VARCHAR(100) NOT NULL,
  exam_name VARCHAR(100) NOT NULL DEFAULT 'Final Exam',
  marks_obtained DECIMAL(6,2) NOT NULL,
  max_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_student_subject_exam (student_id, subject, exam_name),
  CONSTRAINT fk_marks_student FOREIGN KEY (student_id)
    REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT chk_marks_range CHECK (
    marks_obtained >= 0 AND max_marks > 0 AND marks_obtained <= max_marks
  )
);

CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_marks_student ON marks(student_id);
