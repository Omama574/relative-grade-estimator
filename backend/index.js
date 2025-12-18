import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(cors());


// Handle preflight explicitly
app.options("*", cors());

app.use(express.json());

/* ---------- DATABASE ---------- */

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
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("[DB] course_snapshots table ready");
}

/* ---------- ROUTES ---------- */

app.get("/", (_, res) => {
  res.json({ status: "ok", service: "relative-grade-backend" });
});

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
    `,
    [classNbr, courseCode, courseTitle, faculty, slot, totalWeightage, components]
  );

  res.json({ success: true });
});

/* ---------- START ---------- */

const PORT = process.env.PORT || 3000;

initDatabase()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Backend running on port ${PORT}`)
    );
  })
  .catch(err => {
    console.error("[FATAL] Database init failed", err);
    process.exit(1);
  });
