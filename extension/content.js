console.log("[RGE] Content script loaded");

function insertGradeRow(table, data) {
  const row = table.insertRow(-1);
  row.style.background = "#f3f3f3";

  row.innerHTML = `
    <td colspan="2"><b>Relative Grade</b></td>
    <td><b>${data.yourGrade}</b></td>
    <td>Mean: ${data.mean}</td>
    <td>SD: ${data.stdDev}</td>
    <td>Participants: ${data.participants}</td>
  `;
}

function extractAndSend(table) {
  const rows = Array.from(table.querySelectorAll("tr"));

  const courses = [];
  let current = null;

  rows.forEach(row => {
    const cells = Array.from(row.children).map(td =>
      td.innerText.trim()
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
      current.totalWeightage += Number(cells[6]);
      current.components.push({
        component: cells[1],
        weightageMark: Number(cells[6])
      });
    }
  });

  if (current) courses.push(current);

  const theory = courses.filter(c => c.courseType === "Theory Only");

  theory.forEach(async course => {
    await fetch("https://relative-grade-estimator-production.up.railway.app/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(course)
    });

    const res = await fetch(
      `https://relative-grade-estimator-production.up.railway.app/grade/${course.courseCode}/${course.slot}/${course.classNbr}`
    );

    const data = await res.json();
    insertGradeRow(table, data);
  });
}

/* --------- OBSERVER --------- */

const observer = new MutationObserver(() => {
  const table = Array.from(document.querySelectorAll("table"))
    .find(t => t.innerText.includes("Weightage Mark"));

  if (table) {
    observer.disconnect();
    console.log("[RGE] Marks table detected");
    extractAndSend(table);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
