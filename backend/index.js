import express from "express";
import cors from "cors";
import pkg from "pg";
import rateLimit from "express-rate-limit";

const { Pool } = pkg;
const app = express();

/* ---------------- MIDDLEWARE ---------------- */

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json());

// Required for Railway / proxies (rate-limit)
app.set("trust proxy", 1);

app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60              // 60 requests / minute / IP
  })
);

/* ---------------- DATABASE ---------------- */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  // Create table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_snapshots (
      id SERIAL PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_nbr TEXT NOT NULL,
      course_code TEXT NOT NULL,
      course_title TEXT NOT NULL,
      faculty TEXT NOT NULL,
      slot TEXT NOT NULL,
      total_weightage NUMERIC NOT NULL,
      components JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create unique index safely (idempotent)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS course_snapshots_unique_idx
    ON course_snapshots (student_id, class_nbr, course_code, slot);
  `);

  console.log("[DB] course_snapshots ready (table + unique index)");
}

/* ---------------- HELPERS ---------------- */

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values, mu) {
  if (values.length === 1) return 0; // ✅ IMPORTANT: SD = 0 for one student
  const variance =
    values.reduce((a, b) => a + Math.pow(b - mu, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function gradeRanges(mu, sigma) {
  return {
    S: Math.max(mu + 1.5 * sigma, 90),
    A: mu + 0.5 * sigma,
    B: mu - 0.5 * sigma,
    C: mu - 1.0 * sigma,
    D: mu - 1.5 * sigma,
    E: mu - 2.0 * sigma
  };
}

function assignGrade(score, ranges) {
  if (score >= ranges.S) return "S";
  if (score >= ranges.A) return "A";
  if (score >= ranges.B) return "B";
  if (score >= ranges.C) return "C";
  if (score >= ranges.D) return "D";
  if (score >= ranges.E) return "E";
  return "F";
}

/* ---------------- ROUTES ---------------- */

app.get("/", (_, res) => {
  res.json({ status: "ok" });
});

/**
 * Submit / Update student marks
 */
app.post("/submit", async (req, res) => {
  const {
    studentId,
    classNbr,
    courseCode,
    courseTitle,
    faculty,
    slot,
    totalWeightage,
    components
  } = req.body;

  if (
    !studentId ||
    !classNbr ||
    !courseCode ||
    !courseTitle ||
    !faculty ||
    !slot ||
    totalWeightage == null ||
    !components
  ) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  await pool.query(
    `
    INSERT INTO course_snapshots
    (
      student_id,
      class_nbr,
      course_code,
      course_title,
      faculty,
      slot,
      total_weightage,
      components
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (student_id, class_nbr, course_code, slot)
    DO UPDATE SET
      total_weightage = EXCLUDED.total_weightage,
      components = EXCLUDED.components,
      created_at = NOW()
    `,
    [
      studentId,
      classNbr,
      courseCode,
      courseTitle,
      faculty,
      slot,
      totalWeightage,
      JSON.stringify(components)
    ]
  );

  res.json({ success: true });
});

/**
 * Get relative grade result for one student
 */
app.get("/grade", async (req, res) => {
  const { studentId, classNbr, courseCode, slot, faculty } = req.query;

  const { rows } = await pool.query(
    `
    SELECT student_id, total_weightage
    FROM course_snapshots
    WHERE class_nbr=$1 AND course_code=$2 AND slot=$3 AND faculty=$4
    `,
    [classNbr, courseCode, slot, faculty]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "No data yet" });
  }

  const marks = rows.map(r => Number(r.total_weightage));
  const mu = mean(marks);
  const sigma = stdDev(marks, mu);
  const ranges = gradeRanges(mu, sigma);

  const student = rows.find(r => r.student_id === studentId);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  const grade = assignGrade(student.total_weightage, ranges);

  res.json({
    yourMarks: student.total_weightage,
    mean: Number(mu.toFixed(2)),
    sd: Number(sigma.toFixed(2)),
    ranges,
    yourGrade: grade,
    participants: rows.length
  });
});

/* ---------------- START ---------------- */

const PORT = process.env.PORT || 8080;

initDatabase().then(() => {
  app.listen(PORT, () =>
    console.log(`Backend running on ${PORT}`)
  );
});
