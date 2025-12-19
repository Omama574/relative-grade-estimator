console.log("[RGE] Content script loaded");

let hasExtracted = false;

const observer = new MutationObserver(() => {
  if (hasExtracted) return;

  const marksTable = findMarksTable();
  if (!marksTable) return;

  hasExtracted = true;
  console.log("[RGE] Marks table detected");

  const theoryCourses = extractTheoryCourses(marksTable);

  console.log("[RGE] FINAL THEORY COURSES:");
  console.table(theoryCourses);

  chrome.runtime.sendMessage({
    type: "THEORY_COURSES_EXTRACTED",
    payload: theoryCourses
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function findMarksTable() {
  return [...document.querySelectorAll("table")].find(t =>
    t.innerText.includes("Mark Title") &&
    t.innerText.includes("Weightage Mark")
  );
}

function extractTheoryCourses(table) {
  const rows = [...table.querySelectorAll("tr")];
  const courses = [];
  let current = null;

  rows.forEach(row => {
    const cells = [...row.children].map(td =>
      td.innerText.replace(/\s+/g, " ").trim()
    );

    if (!cells.length) return;

    if (cells.length === 9 && cells[1]?.startsWith("VL")) {
      if (current) courses.push(finalize(current));

      current = {
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

    if (current && cells.length === 8 && !isNaN(cells[6])) {
      const mark = Number(cells[6]);
      current.totalWeightage += mark;
      current.components.push({
        component: cells[1],
        weightageMark: mark
      });
    }
  });

  if (current) courses.push(finalize(current));

  return courses.filter(c => c.courseType === "Theory Only");
}

function finalize(course) {
  course.totalWeightage = Number(course.totalWeightage.toFixed(2));
  return course;
}
