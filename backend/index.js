// import express from "express";
// import cors from "cors";
// import pkg from "pg";

// const { Pool } = pkg;
// const app = express();

// /* ---------------- MIDDLEWARE ---------------- */

// app.use(cors({
//   origin: "*",
//   methods: ["GET", "POST"]
// }));
// app.use(express.json());

// /* ---------------- DATABASE ---------------- */

// if (!process.env.DATABASE_URL) {
//   console.error("DATABASE_URL missing");
//   process.exit(1);
// }

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false }
// });

// /* ---------------- INIT DB (FORCE FIX SCHEMA) ---------------- */

// async function initDatabase() {
//   console.log("[DB] Checking schema…");

//   // Drop old broken table
//  -- ⚠️ ONE-TIME RESET SCRIPT
// -- This will DELETE the old table and recreate it properly

// DROP TABLE IF EXISTS course_snapshots;

// CREATE TABLE course_snapshots (
//   id SERIAL PRIMARY KEY,

//   -- anonymized student identity (hash)
//   student_id TEXT NOT NULL,

//   -- course identifiers
//   class_nbr TEXT NOT NULL,
//   course_code TEXT NOT NULL,
//   course_title TEXT NOT NULL,

//   -- grouping keys for relative grading
//   faculty TEXT NOT NULL,
//   slot TEXT NOT NULL,

//   -- marks
//   total_weightage NUMERIC NOT NULL,
//   components JSONB NOT NULL,

//   created_at TIMESTAMP DEFAULT NOW(),

//   -- prevent duplicate submissions by same student
//   UNIQUE (student_id, class_nbr, course_code)
// );

// -- (Optional but recommended for faster grading queries)
// CREATE INDEX idx_grading_group
// ON course_snapshots (class_nbr, faculty, slot);

//   `);

//   console.log("[DB] course_snapshots ready");
// }

// /* ---------------- HELPERS ---------------- */

// function mean(arr) {
//   return arr.reduce((a, b) => a + b, 0) / arr.length;
// }

// function stdDev(arr, mu) {
//   return Math.sqrt(
//     arr.reduce((a, b) => a + Math.pow(b - mu, 2), 0) / arr.length
//   );
// }

// function assignGrade(score, mu, sigma) {
//   if (score >= Math.max(mu + 1.5 * sigma, 90)) return "S";
//   if (score >= mu + 0.5 * sigma) return "A";
//   if (score >= mu - 0.5 * sigma) return "B";
//   if (score >= mu - 1.0 * sigma) return "C";
//   if (score >= mu - 1.5 * sigma) return "D";
//   if (score >= mu - 2.0 * sigma) return "E";
//   return "F";
// }

// /* ---------------- ROUTES ---------------- */

// app.get("/", (_, res) => {
//   res.json({ status: "ok" });
// });

// app.post("/submit", async (req, res) => {
//   const {
//     classNbr,
//     courseCode,
//     courseTitle,
//     faculty,
//     slot,
//     totalWeightage,
//     components
//   } = req.body;

//   if (!classNbr || !courseCode || !slot) {
//     return res.status(400).json({ error: "Invalid payload" });
//   }

//   await pool.query(
//     `
//     INSERT INTO course_snapshots
//     (class_nbr, course_code, course_title, faculty, slot, total_weightage, components)
//     VALUES ($1,$2,$3,$4,$5,$6,$7)
//     ON CONFLICT (class_nbr, course_code)
//     DO UPDATE SET
//       total_weightage = EXCLUDED.total_weightage,
//       components = EXCLUDED.components,
//       created_at = NOW()
//     `,
//     [
//       classNbr,
//       courseCode,
//       courseTitle,
//       faculty,
//       slot,
//       totalWeightage,
//       components
//     ]
//   );

//   res.json({ success: true });
// });

// app.get("/grade/:courseCode/:slot/:classNbr", async (req, res) => {
//   const { courseCode, slot, classNbr } = req.params;

//   const { rows } = await pool.query(
//     `
//     SELECT class_nbr, total_weightage
//     FROM course_snapshots
//     WHERE course_code = $1 AND slot = $2
//     `,
//     [courseCode, slot]
//   );

//   if (rows.length === 0) {
//     return res.status(404).json({ error: "No data yet" });
//   }

//   const marks = rows.map(r => Number(r.total_weightage));
//   const mu = mean(marks);
//   const sigma = stdDev(marks, mu);

//   const student = rows.find(r => r.class_nbr === classNbr);
//   if (!student) {
//     return res.status(404).json({ error: "Student not found" });
//   }

//   const grade = assignGrade(student.total_weightage, mu, sigma);

//   res.json({
//     courseCode,
//     slot,
//     yourMarks: student.total_weightage,
//     mean: Number(mu.toFixed(2)),
//     stdDev: Number(sigma.toFixed(2)),
//     yourGrade: grade,
//     participants: rows.length
//   });
// });

// /* ---------------- START ---------------- */

// const PORT = process.env.PORT || 3000;

// initDatabase().then(() => {
//   app.listen(PORT, () =>
//     console.log(`Backend running on ${PORT}`)
//   );
// });
import pkg from "pg";

const { Pool } = pkg;

/* ---------------- DATABASE CONNECTION ---------------- */

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ---------------- RESET LOGIC ---------------- */

async function resetDatabase() {
  try {
    console.log("⚠️ Dropping existing table (if any)...");

    await pool.query(`
      DROP TABLE IF EXISTS course_snapshots;
    `);

    console.log("✅ Table dropped");

    console.log("🛠 Creating fresh course_snapshots table...");

    await pool.query(`
      CREATE TABLE course_snapshots (
        id SERIAL PRIMARY KEY,

        student_id TEXT NOT NULL,

        class_nbr TEXT NOT NULL,
        course_code TEXT NOT NULL,
        course_title TEXT NOT NULL,

        faculty TEXT NOT NULL,
        slot TEXT NOT NULL,

        total_weightage NUMERIC NOT NULL,
        components JSONB NOT NULL,

        created_at TIMESTAMP DEFAULT NOW(),

        UNIQUE (student_id, class_nbr, course_code)
      );
    `);

    await pool.query(`
      CREATE INDEX idx_grading_group
      ON course_snapshots (class_nbr, faculty, slot);
    `);

    console.log("✅ course_snapshots table created successfully");
  } catch (err) {
    console.error("❌ Database reset failed:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

/* ---------------- RUN ---------------- */

resetDatabase();
