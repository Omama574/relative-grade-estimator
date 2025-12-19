import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: "*" }));

/* ---------------- DATABASE ---------------- */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS course_snapshots (
    id SERIAL PRIMARY KEY,
    class_nbr TEXT NOT NULL,
    course_code TEXT NOT NULL,
    course_title TEXT NOT NULL,
    faculty TEXT,
    slot TEXT,
    total_weightage NUMERIC,
    components JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (class_nbr)
  );
`);

console.log("[DB] course_snapshots ready");

/* ---------------- HEALTH ---------------- */

app.get("/", (_, res) => {
  res.json({ status: "ok" });
});

/* ---------------- SUBMIT ---------------- */

app.post("/submit", async (req, res) => {
  try {
    const courses = req.body;

    if (!Array.isArray(courses)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    for (const c of courses) {
      await pool.query(
        `
        INSERT INTO course_snapshots
        (class_nbr, course_code, course_title, faculty, slot, total_weightage, components)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (class_nbr)
        DO UPDATE SET
          total_weightage = EXCLUDED.total_weightage,
          components = EXCLUDED.components,
          created_at = NOW()
        `,
        [
          c.classNbr,
          c.courseCode,
          c.courseTitle,
          c.faculty,
          c.slot,
          c.totalWeightage,
          c.components   // ← IMPORTANT: pass JSON directly, NOT stringified
        ]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Insert failed:", err);
    res.status(500).json({ error: "DB insert failed" });
  }
});

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Backend running on", PORT);
});