import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_snapshots (
      id SERIAL PRIMARY KEY,
      class_nbr TEXT NOT NULL,
      course_code TEXT NOT NULL,
      course_title TEXT NOT NULL,
      faculty TEXT NOT NULL,
      slot TEXT NOT NULL,
      total_weightage NUMERIC NOT NULL,
      components JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (class_nbr, course_code)
    );
  `);

  console.log("[DB] course_snapshots ready");
}

/* ---------------- HELPERS ---------------- */

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values, mu) {
  const variance =
    values.reduce((a, b) => a + Math.pow(b - mu, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function assignGrade(score, mu, sigma) {
  if (score >= Math.max(mu + 1.5 * sigma, 90)) return "S";
  if (score >= mu + 0.5 * sigma) return "A";
  if (score >= mu - 0.5 * sigma) return "B";
  if (score >= mu - 1.0 * sigma) return "C";
  if (score >= mu - 1.5 * sigma) return "D";
  if (score >= mu - 2.0 * sigma) return "E";
  return "F";
}

/* ---------------- ROUTES ---------------- */

app.get("/", (_, res) => {
  res.json({ status: "ok" });
});

/**
 * INSERT / UPDATE student data (NO DUPLICATES)
 */
app.post("/submit", async (req, res) => {
  const {
    classNbr,
    courseCode,
    courseTitle,
    faculty,
    slot,
    totalWeightage,
    components
  } = req.body;

  await pool.query(
    `
    INSERT INTO course_snapshots
    (class_nbr, course_code, course_title, faculty, slot, total_weightage, components)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (class_nbr, course_code)
    DO UPDATE SET
      total_weightage = EXCLUDED.total_weightage,
      components = EXCLUDED.components,
      created_at = NOW()
    `,
    [
      classNbr,
      courseCode,
      courseTitle,
      faculty,
      slot,
      totalWeightage,
      components
    ]
  );

  res.json({ success: true });
});

/**
 * GET grade for ONE student
 */
app.get("/grade/:courseCode/:slot/:classNbr", async (req, res) => {
  const { courseCode, slot, classNbr } = req.params;

  const { rows } = await pool.query(
    `
    SELECT class_nbr, total_weightage
    FROM course_snapshots
    WHERE course_code = $1 AND slot = $2
    `,
    [courseCode, slot]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "No data yet" });
  }

  const marks = rows.map(r => Number(r.total_weightage));
  const mu = mean(marks);
  const sigma = stdDev(marks, mu);

  const student = rows.find(r => r.class_nbr === classNbr);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  const grade = assignGrade(student.total_weightage, mu, sigma);

  res.json({
    courseCode,
    slot,
    yourMarks: student.total_weightage,
    mean: Number(mu.toFixed(2)),
    stdDev: Number(sigma.toFixed(2)),
    yourGrade: grade,
    participants: rows.length
  });
});

/* ---------------- START ---------------- */

const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
  app.listen(PORT, () =>
    console.log(`Backend running on ${PORT}`)
  );
});
