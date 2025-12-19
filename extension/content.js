console.log("[RGE] Content script loaded");

let hasExtracted = false;

/* ---------------- MUTATION OBSERVER ---------------- */

const observer = new MutationObserver(() => {
  if (hasExtracted) return;

  const marksTable = findMarksTable();
  if (marksTable) {
    hasExtracted = true;
    console.log("[RGE] Marks table detected");
    const theoryCourses = extractTheoryCourses(marksTable);

    if (theoryCourses.length > 0) {
      chrome.runtime.sendMessage({
        type: "SUBMIT_COURSES",
        payload: theoryCourses
      });
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

/* ---------------- FIND MARKS TABLE ---------------- */

function findMarksTable() {
  const tables = Array.from(document.querySelectorAll("table"));
  return tables.find(t =>
    t.innerText.includes("Mark Title") &&
    t.innerText.includes("Weightage Mark")
  );
}

/* ---------------- EXTRACTION LOGIC ---------------- */

function extractTheoryCourses(table) {
  const rows = Array.from(table.querySelectorAll("tr"));
  console.log("[RGE] Total rows found:", rows.length);

  const courses = [];
  let currentCourse = null;

  rows.forEach(row => {
    const cells = Array.from(row.children).map(td =>
      td.innerText.replace(/\s+/g, " ").trim()
    );

    if (cells.length === 0) return;

    /* ---------- COURSE HEADER ---------- */
    if (cells.length === 9 && cells[1]?.startsWith("VL")) {
      if (currentCourse) courses.push(finalize(currentCourse));

      currentCourse = {
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

    /* ---------- MARK ROW ---------- */
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

  const theoryOnly = courses.filter(
    c => c.courseType === "Theory Only"
  );

  console.log("[RGE] FINAL THEORY COURSES:");
  console.table(theoryOnly);

  return theoryOnly;
}

/* ---------------- HELPERS ---------------- */

function finalize(course) {
  course.totalWeightage = Number(course.totalWeightage.toFixed(2));
  return course;
}
