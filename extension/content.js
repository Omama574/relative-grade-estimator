console.log("[RGE] Content script loaded");

let hasExtracted = false;

/* ---------------- CSS ---------------- */

function injectCSS() {
  if (document.getElementById("rge-style")) return;

  const style = document.createElement("style");
  style.id = "rge-style";
  style.innerHTML = `
    .rge-wrapper {
      margin: 12px 0;
      background: #1e1e1e;
      border-radius: 6px;
      padding: 8px;
    }

    .rge-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      color: #eaeaea;
    }

    .rge-table th,
    .rge-table td {
      border: 1px solid #333;
      padding: 6px;
      text-align: center;
    }

    .rge-table thead {
      background: #2a2a2a;
    }

    .rge-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: #9ad1ff;
    }
  `;
  document.head.appendChild(style);
}

/* ---------------- REGISTER NUMBER ---------------- */

function getStudentId() {
  const input = document.querySelector("#authorizedIDX");
  if (!input) return null;

  const regNo = input.value?.trim();
  console.log("[RGE] Extracted Register Number:", regNo);
  return regNo || null;
}

/* ---------------- FIND MARKS TABLE ---------------- */

function findMarksTable() {
  const tables = Array.from(document.querySelectorAll("table"));
  return tables.find(t =>
    t.innerText.includes("Mark Title") &&
    t.innerText.includes("Weightage Mark")
  );
}

/* ---------------- EXTRACTION LOGIC ---------------- */

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

    // COURSE HEADER
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
    if (currentCourse && cells.length === 8 && !isNaN(cells[6])) {
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

/* ---------------- BACKEND SUBMISSION (ONCE) ---------------- */

function handleExtractionOnce() {
  if (hasExtracted) return;

  const marksTable = findMarksTable();
  if (!marksTable) return;

  const studentId = getStudentId();
  if (!studentId) return;

  hasExtracted = true;
  console.log("[RGE] Marks table detected");

  const theoryCourses = extractTheoryCourses(marksTable, studentId);

  console.log("[RGE] FINAL THEORY COURSES:");
  console.table(theoryCourses);

  if (chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage(
      { type: "SUBMIT", payload: theoryCourses },
      () => {
        if (chrome.runtime.lastError) {
          console.error("[RGE] sendMessage error:", chrome.runtime.lastError.message);
        } else {
          console.log("[RGE] Data sent to background.js");
        }
      }
    );
  }
}

/* ---------------- RELATIVE GRADING UI ---------------- */

function buildRelativeGradeTable(data) {
  const { participants, mean, sd, ranges } = data;

  return `
    <div class="rge-wrapper">
      <div class="rge-title">Relative Grading (Estimated)</div>
      <table class="rge-table">
        <thead>
          <tr>
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
          </tr>
        </thead>
        <tbody>
          <tr>
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
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function extractCourseMeta(block) {
  const row = block.querySelector("table tbody tr");
  if (!row) return null;

  const cells = row.querySelectorAll("td");

  return {
    classNbr: cells[1]?.innerText.trim(),
    courseCode: cells[2]?.innerText.trim(),
    faculty: cells[6]?.innerText.trim(),
    slot: cells[7]?.innerText.trim()
  };
}

async function fetchRelativeGrade(meta, studentId) {
  const params = new URLSearchParams({
    studentId,
    classNbr: meta.classNbr,
    courseCode: meta.courseCode,
    slot: meta.slot,
    faculty: meta.faculty
  });

  const res = await fetch(`https://YOUR_BACKEND_URL/grade?${params}`);
  if (!res.ok) throw new Error("No grade data");

  return res.json();
}

async function injectRelativeGrades() {
  injectCSS();

  const studentId = getStudentId();
  if (!studentId) return;

  const blocks = document.querySelectorAll(".table-responsive");

  for (const block of blocks) {
    if (block.dataset.rgeInjected) continue;

    const meta = extractCourseMeta(block);
    if (!meta) continue;

    try {
      const data = await fetchRelativeGrade(meta, studentId);
      block.insertAdjacentHTML("afterend", buildRelativeGradeTable(data));
      block.dataset.rgeInjected = "true";
    } catch {
      // silently skip
    }
  }
}

/* ---------------- SINGLE OBSERVER ---------------- */

const observer = new MutationObserver(() => {
  handleExtractionOnce();
  injectRelativeGrades();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
