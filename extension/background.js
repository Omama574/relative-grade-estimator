console.log("[RGE BG] Background running");

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "THEORY_COURSES_EXTRACTED") {
    handleCourses(msg.payload);
  }
});

async function handleCourses(courses) {
  for (const course of courses) {
    try {
      const res = await fetch(
        "https://relative-grade-estimator-production.up.railway.app/submit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(course)
        }
      );

      if (!res.ok) {
        console.error("[RGE BG] Failed:", res.status);
        continue;
      }

      console.log("[RGE BG] Sent:", course.courseCode);
    } catch (err) {
      console.error("[RGE BG] Network error", err);
    }
  }
}
