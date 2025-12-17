console.log("[RGE] Content script loaded");

let marksViewSeen = false;
let extracted = false;

const observer = new MutationObserver(() => {
  if (!marksViewSeen && document.body.innerText.includes("Marks View")) {
    marksViewSeen = true;
    console.log("[RGE] Marks View detected");
  }

  if (marksViewSeen && !extracted) {
    const marksTable = findMarksTable();
    if (marksTable) {
      extracted = true;
      console.log("[RGE] Marks table detected, extracting data");
      extractTheoryCourses(marksTable);
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function findMarksTable() {
  const tables = Array.from(document.querySelectorAll("table"));
  return tables.find(t =>
    t.innerText.includes("Mark Title") &&
    t.innerText.includes("Weightage Mark")
  );
}

function extractTheoryCourses(marksTable) {
  const rows = Array.from(marksTable.querySelectorAll("tr"));
  console.log("[RGE] Total rows found:", rows.length);

  const extractedCourses = [];
  let currentCourse = null;

  rows.forEach(row => {
    const cells = Array.from(row.children).map(td =>
      td.innerText.replace(/\s+/g, " ").trim()
    );

    if (cells.length === 0) return;

    /* ================= COURSE HEADER ================= */
    if (cells.length === 9 && cells[1]?.startsWith("VL")) {
      if (currentCourse) {
        extractedCourses.push(finalizeCourse(currentCourse));
      }

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

    /* ================= MARK ROW ================= */
    if (
      currentCourse &&
      cells.length === 8 &&
      !isNaN(parseFloat(cells[6]))
    ) {
      const weightage = parseFloat(cells[6]);
      currentCourse.totalWeightage += weightage;
      currentCourse.components.push({
        component: cells[1],
        weightageMark: weightage
      });
    }
  });

  if (currentCourse) {
    extractedCourses.push(finalizeCourse(currentCourse));
  }

  const theoryCourses = extractedCourses.filter(
    c => c.courseType === "Theory Only"
  );

  console.log("[RGE] FINAL THEORY COURSES:");
  console.table(theoryCourses);
  console.log(theoryCourses);
}

function finalizeCourse(course) {
  course.totalWeightage = Number(course.totalWeightage.toFixed(2));
  return course;
}
