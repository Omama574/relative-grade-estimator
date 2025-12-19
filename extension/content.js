console.log("[RGE] Content script loaded");

let hasExtracted = false;

/* ---------------- REGISTER NUMBER ---------------- */

function getStudentId() {
  const input = document.querySelector("#authorizedIDX");
  if (!input) return null;

  const regNo = input.value?.trim();
  console.log("[RGE] Extracted Register Number:", regNo);

  return regNo || null;
}


/* ---------------- MUTATION OBSERVER ---------------- */

const observer = new MutationObserver(() => {
  if (hasExtracted) return;

  const marksTable = findMarksTable();
  if (!marksTable) return;

  const studentId = getStudentId();
  console.log("[RGE] Extracted Register Number:", studentId);

  if (!studentId) {
    console.warn("[RGE] Register number not found, aborting.");
    return;
  }

  hasExtracted = true;
  console.log("[RGE] Marks table detected");

  const theoryCourses = extractTheoryCourses(marksTable, studentId);

  console.log("[RGE] FINAL THEORY COURSES:");
  console.table(theoryCourses);

  /* ---- SAFE SEND ---- */
  if (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.sendMessage
  ) {
    chrome.runtime.sendMessage(
      {
        type: "SUBMIT",
        payload: theoryCourses
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "[RGE] sendMessage error:",
            chrome.runtime.lastError.message
          );
        } else {
          console.log("[RGE] Data sent to background.js");
        }
      }
    );
  } else {
    console.error(
      "[RGE] chrome.runtime.sendMessage not available"
    );
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

function extractTheoryCourses(table, studentId) {
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

  return courses.filter(c => c.courseType === "Theory Only");
}

/* ---------------- HELPERS ---------------- */

function finalize(course) {
  course.totalWeightage = Number(course.totalWeightage.toFixed(2));
  return course;
}
