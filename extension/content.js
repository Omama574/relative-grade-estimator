console.log("[RGE] Content script loaded");

let extracted = false;

const observer = new MutationObserver(() => {
  if (extracted) return;

  const table = findMarksTable();
  if (!table) return;

  extracted = true;
  console.log("[RGE] Marks table detected");

  const courses = extractTheoryCourses(table);

  console.log("[RGE] FINAL THEORY COURSES:");
  console.table(courses);

  chrome.runtime.sendMessage({
    type: "THEORY_COURSES_EXTRACTED",
    payload: courses
  });
});

observer.observe(document.body, { childList: true, subtree: true });

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

  for (const row of rows) {
    const cells = [...row.children].map(td =>
      td.innerText.replace(/\s+/g, " ").trim()
    );

    if (cells.length === 9 && cells[1]?.startsWith("VL")) {
      if (current) courses.push(current);

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
    }

    if (current && cells.length === 8 && !isNaN(cells[6])) {
      const w = parseFloat(cells[6]);
      current.totalWeightage += w;
      current.components.push({
        component: cells[1],
        weightageMark: w
      });
    }
  }

  if (current) courses.push(current);

  return courses.filter(c => c.courseType === "Theory Only")
                .map(c => ({
                  ...c,
                  totalWeightage: Number(c.totalWeightage.toFixed(2))
                }));
}
