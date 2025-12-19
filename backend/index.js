import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;

const app = express();

/* ---------- MIDDLEWARE ---------- */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* ---------- DATABASE ---------- */
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/* ---------- INIT DB (AUTHORITATIVE SCHEMA) ---------- */
async function initDatabase() {
  console.log("⏳ Initializing database...");

  await pool.query(`
    DROP TABLE IF EXISTS course_snapshots;
  `);

  await pool.query(`
    CREATE TABLE course_snapshots (
      id SERIAL PRIMARY KEY,
      class_nbr TEXT NOT NULL,
      course_code TEXT NOT NULL,
      course_title TEXT NOT NULL,
      course_type TEXT NOT NULL,
      faculty TEXT NOT NULL,
      slot TEXT NOT NULL,
      total_weightage NUMERIC NOT NULL,
      components JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("✅ course_snapshots table recreated");
}

/* ---------- ROUTES ---------- */
app.get("/", (_, res) => {
  res.json({ status: "ok" });
});

app.post("/submit", async (req, res) => {
  try {
    const {
      classNbr,
      courseCode,
      courseTitle,
      courseType,
      faculty,
      slot,
      totalWeightage,
      components,
    } = req.body;

    await pool.query(
      `
      INSERT INTO course_snapshots
      (class_nbr, course_code, course_title, course_type, faculty, slot, total_weightage, components)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        classNbr,
        courseCode,
        courseTitle,
        courseType,
        faculty,
        slot,
        totalWeightage,
        JSON.stringify(components),
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Insert failed:", err.message);
    res.status(500).json({ error: "Insert failed" });
  }
});

/* ---------- START ---------- */
const PORT = process.env.PORT || 3000;

initDatabase()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`🚀 Backend running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ DB init failed", err);
    process.exit(1);
  });
