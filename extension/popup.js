const contentDiv = document.getElementById("content");

chrome.runtime.sendMessage(
  { type: "GET_LATEST_COURSES" },
  response => {
    if (!response || response.data.length === 0) {
      contentDiv.innerHTML = "Open Marks View in VTOP to load data.";
      return;
    }

    contentDiv.innerHTML = "";

    response.data.forEach(course => {
      const div = document.createElement("div");
      div.className = "course";
      div.innerHTML = `
        <div><strong>${course.courseCode}</strong> – ${course.courseTitle}</div>
        <div class="weight">Total: ${course.totalWeightage}/100</div>
        <div>${course.faculty}</div>
      `;
      contentDiv.appendChild(div);
    });
  }
);
