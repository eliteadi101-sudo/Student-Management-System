# CampusDesk — Student Management System

A beginner-friendly full-stack student management application built with **HTML, CSS, JavaScript, Node.js, Express, and MySQL**.

## Features

- Dashboard with student count, today's attendance, present count, and average score.
- Student directory: create, view, search, edit, and delete student records.
- Attendance: mark Present, Absent, Late, or Excused by date; update the same student's record for that date; filter by date.
- Marks: save scores by student, subject, and exam; validate scores; calculate percentages and grades.
- Results: calculate total marks, overall percentage, grade, and Pass/Fail/Pending status.
- Export results as CSV.
- Responsive layout for desktop and mobile.
- Parameterized SQL queries and server-side validation.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Backend/API | Node.js, Express |
| Database | MySQL |
| Database driver | mysql2 |
| Configuration | dotenv |

> MySQL cannot be accessed securely directly from a browser. The Express backend connects the frontend to MySQL.

## Requirements

- Node.js 18 or later (Node.js 20+ recommended)
- MySQL 8+ (or a compatible local MySQL installation)
- A terminal / command prompt

## Setup

### 1. Create the database

Start your MySQL server. In MySQL Workbench, phpMyAdmin's SQL tab, or the MySQL command line, execute:

```sql
SOURCE /full/path/to/student-management-system/database/schema.sql;
```

If `SOURCE` is not supported by your SQL editor, open `database/schema.sql` and execute its contents. The script creates the `student_management` database and the required tables.

### 2. Configure environment variables

Copy `.env.example` to `.env` in the project root and edit the MySQL credentials.

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

**macOS/Linux:**
```bash
cp .env.example .env
```

Example `.env`:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=student_management
```

Do not commit `.env` to GitHub. It is ignored by `.gitignore`.

### 3. Install dependencies

From the project root:

```bash
npm install
```

### 4. Start the application

```bash
npm start
```

Open **http://localhost:3000** in your browser.

For development with Node's watch mode (supported Node versions):
```bash
npm run dev
```

### 5. Check database connection

Open `http://localhost:3000/api/health`. A successful response looks like:

```json
{"ok":true,"database":"connected"}
```

If this endpoint reports an error, confirm that MySQL is running, the database exists, and the `.env` credentials are correct.

## Using the app

1. Open **Students** and add a student with a unique roll number.
2. Open **Attendance** and select the student, date, and status.
3. Open **Marks** and enter the subject, exam, marks obtained, and maximum marks.
4. Open **Results** to see totals, percentages, grades, and result status.
5. Use **Export CSV** on the Results page to download the results.

### Grade scale

| Percentage | Grade |
|---:|---|
| 90–100% | A+ |
| 80–89.99% | A |
| 70–79.99% | B |
| 60–69.99% | C |
| 50–59.99% | D |
| Below 50% | F |

The result status uses a 35% passing threshold. Adjust the CASE expressions in `server.js` if your institution requires a different threshold.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check API and database |
| GET | `/api/dashboard` | Dashboard totals |
| GET | `/api/students?search=` | List/search students |
| POST | `/api/students` | Create student |
| PUT | `/api/students/:id` | Update student |
| DELETE | `/api/students/:id` | Delete student and related records |
| GET | `/api/attendance?date=YYYY-MM-DD` | List attendance, optionally by date |
| POST | `/api/attendance` | Add/update attendance for a student and date |
| DELETE | `/api/attendance/:id` | Delete attendance record |
| GET | `/api/marks` | List mark entries |
| POST | `/api/marks` | Add/update a student's subject/exam score |
| DELETE | `/api/marks/:id` | Delete mark entry |
| GET | `/api/results` | Calculated academic results |

### Example: create a student

```bash
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d "{\"roll_number\":\"CS-001\",\"first_name\":\"Asha\",\"last_name\":\"Kumar\",\"class_name\":\"BCA 2nd Year\",\"section\":\"A\",\"email\":\"asha@example.com\"}"
```

## Project structure

```text
student-management-system/
├── database/
│   └── schema.sql
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## Upload to GitHub

1. Create an empty GitHub repository.
2. Open a terminal in this project directory.
3. Run:

```bash
git init
git add .
git commit -m "Build student management system"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the remote URL with your own repository URL. Keep `.env` and all real passwords out of GitHub.

## Notes and limitations

- This is a learning/demo project. It does not include user login, role-based permissions, deployment configuration, or audit logs.
- Before using it for real student data, add authentication and authorization, HTTPS, backups, stronger operational monitoring, and a privacy policy.
- Deleting a student cascades to that student's attendance and marks.
- Each student can have one attendance record per date. Saving another status for the same date updates the existing record.
- Each student can have one record for a given subject and exam. Saving that combination updates its score.
