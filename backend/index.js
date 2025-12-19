import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS course_snapshots (
    id SERIAL PRIMARY KEY,
    class_nbr TEXT,
    course_code TEXT,
    course_title TEXT,
    faculty TEXT,
    slot TEXT,
    total_weightage NUMERIC,
    components JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )
`);

app.get("/", (_, res) => {
  res.json({ status: "ok" });
});

app.post("/submit", async (req, res) => {
  const c = req.body;

  await pool.query(
    `INSERT INTO course_snapshots
     (class_nbr, course_code, course_title, faculty, slot, total_weightage, components)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      c.classNbr,
      c.courseCode,
      c.courseTitle,
      c.faculty,
      c.slot,
      c.totalWeightage,
      c.components
    ]
  );

  res.json({ success: true });
});
app.post("/_migrate", async (req, res) => {
  try {
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

    res.json({ success: true, message: "Table created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Backend running")
);
