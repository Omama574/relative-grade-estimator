console.log("[RGE] Content script loaded");

let hasRun = false;

/* -------- Extract Student ID -------- */

function getStudentId() {
  const el = document.querySelector(".navbar-text");
  return el ? el.innerText.split("(")[0].trim() : null;
}

/* -------- Observer -------- */

const observer = new MutationObserver(() => {
  if (hasRun) return;

  const table = findMarksTable();
  if (!table) return;

  hasRun = true;
  console.log("[RGE] Marks table detected");

  const studentId = getStudentId();
  if (!studentId) return;

  const courses = extractCourses(table, studentId);
  chrome.runtime.sendMessage({ type: "SUBMIT", payload: courses });
});

observer.observe(document.body, { childList: true, subtree: true });

/* -------- Helpers -------- */

function findMarksTable() {
  return [...document.querySelectorAll("table")]
    .find(t => t.innerText.includes("Mark Title"));
}

function extractCourses(table, studentId) {
  const rows = [...table.querySelectorAll("tr")];
  const courses = [];
  let current = null;

  rows.forEach(row => {
    const cells = [...row.children].map(td => td.innerText.trim());

    if (cells.length === 9 && cells[1]?.startsWith("VL")) {
      if (current) courses.push(current);
      current = {
        studentId,
        classNbr: cells[1],
        courseCode: cells[2],
        courseTitle: cells[3],
        faculty: cells[6],
        slot: cells[7],
        totalWeightage: 0,
        components: []
      };
    }

    if (current && cells.length === 8 && !isNaN(cells[6])) {
      const mark = parseFloat(cells[6]);
      current.totalWeightage += mark;
      current.components.push({
        component: cells[1],
        weightageMark: mark
      });
    }
  });

  if (current) courses.push(current);

  return courses.map(c => ({
    ...c,
    totalWeightage: Number(c.totalWeightage.toFixed(2))
  }));
}
