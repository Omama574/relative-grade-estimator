import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;
const app = express();

/* ---------- MIDDLEWARE ---------- */
app.use(express.json());
app.use(cors({ origin: "*" }));

/* ---------- HEALTH CHECK ---------- */
app.get("/", (_, res) => {
  res.json({ status: "ok" });
});

/* ---------- DATABASE ---------- */
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ---------- ROUTE ---------- */
app.post("/submit", async (req, res) => {
  try {
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
      `INSERT INTO course_snapshots
       (class_nbr, course_code, course_title, faculty, slot, total_weightage, components)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [classNbr, courseCode, courseTitle, faculty, slot, totalWeightage, components]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Insert failed:", err);
    res.status(500).json({ error: "db_error" });
  }
});

/* ---------- START ---------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
