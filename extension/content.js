console.log("[Relative Grade Estimator] Content script loaded");

let detected = false;

const observer = new MutationObserver(() => {
  if (detected) return;

  if (document.body.innerText.includes("Marks View")) {
    detected = true;
    console.log("[Relative Grade Estimator] Marks page detected via DOM");
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
