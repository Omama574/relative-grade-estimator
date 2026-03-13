/* =====================================================
   CONFIG
===================================================== */

const CONFIG = {
  BACKEND_URL: "https://relative-grade-estimator-production.up.railway.app" // UPDATE THIS after new deployment
};

console.log("[RGE BG] Background running");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SUBMIT") {
    handleSubmit(msg.payload)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true; // ⭐ REQUIRED
  }
});


async function handleSubmit(courses) {
  for (const course of courses) {
    try {
      await fetch(`${CONFIG.BACKEND_URL}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(course)
      });
    } catch (err) {
      console.error("[RGE BG] Submit failed", err);
    }
  }
}
