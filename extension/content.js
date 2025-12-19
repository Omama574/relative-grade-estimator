console.log("[RGE] Content script loaded");

/* =====================================================
   GLOBAL STATE
===================================================== */

let hasSubmitted = false;
const injectedCourseKeys = new Set(); // ⭐ FIX: stable de-duplication

/* =====================================================
   REGISTER NUMBER
===================================================== */

function getStudentId() {
  const input = document.querySelector("#authorizedIDX");
  if (!input) return null;

  const regNo = input.value?.trim();
  if (regNo) {
    console.log("[RGE] Extracted Register Number:", regNo);
    return regNo;
  }
  return null;
}

/* =====================================================
   FIND MARKS TABLE (FOR DATA EXTRACTION)
===================================================== */

function findMarksTable() {
  const tables = Array.from(document.querySelectorAll("table"));
  return tables.find(
    t =>
      t.innerText.includes("Mark Title") &&
      t.innerText.includes("Weightage Mark")
  );
}

/* =====================================================
   EXTRACT THEORY COURSES (SUBMISSION PAYLOAD)
===================================================== */

function extractTheoryCourses(table, studentId) {
  const rows = Array.from(table.querySelectorAll("tr"));
  console.log("[RGE] Total rows found:", rows.length);

  const courses = [];
  let currentCourse = null;

  rows.forEach(row => {
    const cells = Array.from(row.children).map(td =>
      td.innerText.replace(/\s+/g, " ").trim()
    );

    if (!cells.length) return;

    // COURSE HEADER ROW
    if (cells.length === 9 && cells[1]?.startsWith("VL")) {
      if (currentCourse) courses.push(finalize(currentCourse));

      currentCourse = {
        studentId,
        classNbr: cells[1],
        courseCode: cells[2],
        courseTitle: cells[3],
        courseType: cells[4],
        faculty: cells[6],
        slot: cells[7],
        totalWeightage: 0,
        components: []
      };
      return;
    }

    // MARK ROW
    if (
      currentCourse &&
      cells.length === 8 &&
      !isNaN(parseFloat(cells[6]))
    ) {
      const mark = parseFloat(cells[6]);
      currentCourse.totalWeightage += mark;
      currentCourse.components.push({
        component: cells[1],
        weightageMark: mark
      });
    }
  });

  if (currentCourse) courses.push(finalize(currentCourse));

  return courses.filter(c => c.courseType === "Theory Only");
}

function finalize(course) {
  course.totalWeightage = Number(course.totalWeightage.toFixed(2));
  return course;
}

/* =====================================================
   UI: BUILD RELATIVE GRADE TABLE
===================================================== */

function buildRelativeGradeRow(data) {
  const { participants, mean, sd, ranges, yourGrade, yourMarks } = data;

  return `
    <tr class="rge-row">
      <td colspan="9">
        <div class="rge-wrapper">
          <table class="rge-table">
            <thead>
              <tr>
                <th>Your Marks</th>
                <th>Participants</th>
                <th>Mean</th>
                <th>SD</th>
                <th>S</th>
                <th>A</th>
                <th>B</th>
                <th>C</th>
                <th>D</th>
                <th>E</th>
                <th>F</th>
                <th>Your Grade</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${yourMarks}</td>
                <td>${participants}</td>
                <td>${mean}</td>
                <td>${sd}</td>
                <td>&ge; ${ranges.S.toFixed(1)}</td>
                <td>&ge; ${ranges.A.toFixed(1)}</td>
                <td>&ge; ${ranges.B.toFixed(1)}</td>
                <td>&ge; ${ranges.C.toFixed(1)}</td>
                <td>&ge; ${ranges.D.toFixed(1)}</td>
                <td>&ge; ${ranges.E.toFixed(1)}</td>
                <td>&lt; ${ranges.E.toFixed(1)}</td>
                <td class="rge-grade">${yourGrade}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  `;
}

/* =====================================================
   UI: FETCH & INJECT RELATIVE GRADES
===================================================== */

async function injectRelativeGrades() {
  const studentId = getStudentId();
  if (!studentId) return;

  const mainTable = document.querySelector("#fixedTableContainer table");
  if (!mainTable) return;

  const rows = Array.from(mainTable.querySelectorAll("tbody > tr"));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll("td");

    // COURSE HEADER ROW
    if (cells.length === 9 && cells[4]?.innerText.trim() === "Theory Only") {
      // 🔒 hard lock per course
      if (row.dataset.rgeInjected === "true") continue;

      const meta = {
        classNbr: cells[1].innerText.trim(),
        courseCode: cells[2].innerText.trim(),
        faculty: cells[6].innerText.trim(),
        slot: cells[7].innerText.trim()
      };

      // 🔍 find LAST row belonging to this course
      let targetRow = row;
      for (let j = i + 1; j < rows.length; j++) {
        const nextCells = rows[j].querySelectorAll("td");
        if (nextCells.length === 9 || nextCells.length === 0) break;
        targetRow = rows[j];
      }

      // mark early to prevent race duplicates
      row.dataset.rgeInjected = "true";

      try {
        const params = new URLSearchParams({
          studentId,
          classNbr: meta.classNbr,
          courseCode: meta.courseCode,
          slot: meta.slot,
          faculty: meta.faculty
        });

        const res = await fetch(
          `https://relative-grade-estimator-production.up.railway.app/grade?${params}`
        );
        if (!res.ok) throw new Error("No grade data");

        const data = await res.json();

        // ✅ inject AFTER all marks
        targetRow.insertAdjacentHTML(
          "afterend",
          buildRelativeGradeRow(data)
        );
      } catch (err) {
        console.warn("[RGE] Grade fetch failed:", meta.courseCode);
        // Optional: delete row.dataset.rgeInjected to retry
      }
    }
  }
}




/* =====================================================
   STYLES (SCOPED, SAFE)
===================================================== */

const style = document.createElement("style");
style.textContent = `
.rge-row td {
  padding: 0 !important;
  border: none !important;
}

  .rge-wrapper { margin: 10px 0; }
  .rge-table {
    width: 100%;
    border-collapse: collapse;
    background: #1e1e1e;
    color: #eaeaea;
    font-size: 12px;
  }
  .rge-table th, .rge-table td {
    border: 1px solid #444;
    padding: 6px;
    text-align: center;
  }
  .rge-table th {
    background: #2c3e50;
    font-weight: 600;
  }
  .rge-grade {
    font-weight: bold;
    color: #00e676;
  }
`;
document.head.appendChild(style);

/* =====================================================
   MUTATION OBSERVER (SINGLE, SAFE)
===================================================== */

const observer = new MutationObserver(() => {
  // 1️⃣ Submit data ONCE
  if (!hasSubmitted) {
    const table = findMarksTable();
    const studentId = getStudentId();

    if (table && studentId) {
      hasSubmitted = true;
      const courses = extractTheoryCourses(table, studentId);

      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.sendMessage
      ) {
        chrome.runtime.sendMessage(
          { type: "SUBMIT", payload: courses },
          () => {
            if (chrome.runtime.lastError) {
              console.error(
                "[RGE] sendMessage error:",
                chrome.runtime.lastError.message
              );
            } else {
              console.log("[RGE] Data submitted successfully");
            }
          }
        );
      }
    }
  }

  // 2️⃣ Inject UI (SAFE, NON-DUPLICATING)
  injectRelativeGrades();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
