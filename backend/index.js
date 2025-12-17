import express from "express";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Ensure database schema exists
 */
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_snapshots (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      class_nbr TEXT NOT NULL,
      total_weightage REAL NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  console.log("[DB] course_snapshots table ready");
}

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "relative-grade-backend" });
});

app.post("/api/submit", async (req, res) => {
  const { classNbr, totalWeightage } = req.body;

  if (!classNbr || typeof totalWeightage !== "number") {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    await pool.query(
      `
      INSERT INTO course_snapshots (class_nbr, total_weightage)
      VALUES ($1, $2)
      `,
      [classNbr, totalWeightage]
    );

    res.json({ status: "ok" });
  } catch (err) {
    console.error("[DB ERROR]", err);
    res.status(500).json({ error: "Database error" });
  }
});

const PORT = process.env.PORT || 3000;

/**
 * Start server ONLY after DB is ready
 */
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("[FATAL] Database init failed", err);
    process.exit(1);
  });
