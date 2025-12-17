console.log("[RGE] Background service worker started");

let latestTheoryCourses = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "THEORY_COURSES_EXTRACTED") {
    latestTheoryCourses = message.payload;
    console.log("[RGE] Stored theory courses:", latestTheoryCourses);
    sendResponse({ status: "ok" });
  }

  if (message.type === "GET_LATEST_COURSES") {
    sendResponse({
      status: "ok",
      data: latestTheoryCourses
    });
  }

  return true;
});
