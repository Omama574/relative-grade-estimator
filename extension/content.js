console.log("[RGE] Content script loaded");

let sent = false;

const observer = new MutationObserver(() => {
  if (sent) return;

  const table = findMarksTable();
  if (!table) return;

  sent = true;
  console.log("[RGE] Marks table detected");

  const courses = extractTheoryCourses(table);
  console.log("[RGE] FINAL THEORY COURSES:");
  console.table(courses);

  // 🔴 THIS is the missing link
  chrome.runtime.sendMessage({
    type: "THEORY_COURSES_EXTRACTED",
    payload: courses
  });
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

function extractTheoryCourses(table) {
  const rows = Array.from(table.querySelectorAll("tr"));
  const results = [];
  let current = null;

  rows.forEach(row => {
    const cells = Array.from(row.children).map(td =>
      td.innerText.replace(/\s+/g, " ").trim()
    );

    // Course header
    if (cells.length === 9 && cells[1]?.startsWith("VL")) {
      if (current) results.push(current);

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

    // Marks row
    if (current && cells.length === 8 && !isNaN(cells[6])) {
      const w = Number(cells[6]);
      current.totalWeightage += w;
      current.components.push({
        component: cells[1],
        weightageMark: w
      });
    }
  });

  if (current) results.push(current);

  return results.filter(c => c.courseType === "Theory Only");
}
