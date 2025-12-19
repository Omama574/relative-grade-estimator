console.log("[RGE BG] Background running");

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  if (msg.type === "SUBMIT") {
    handleSubmit(msg.payload);
  }
});

async function handleSubmit(courses) {
  for (const course of courses) {
    try {
      await fetch("https://relative-grade-estimator-production.up.railway.app/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(course)
      });
    } catch (err) {
      console.error("[RGE BG] Submit failed", err);
    }
  }
}
