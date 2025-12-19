console.log("[RGE BG] Background running");

const API_URL = "https://relative-grade-estimator-production.up.railway.app/submit";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "THEORY_COURSES_EXTRACTED") {
    handleCourses(message.payload);
  }
});

async function handleCourses(courses) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        courses // 🔴 IMPORTANT: send as array
      })
    });

    if (!res.ok) {
      console.error("[RGE BG] Failed:", res.status);
      return;
    }

    const data = await res.json();
    console.log("[RGE BG] Success:", data);
  } catch (err) {
    console.error("[RGE BG] Network error", err);
  }
}
