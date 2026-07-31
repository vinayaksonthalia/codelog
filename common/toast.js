// CodeLog — shared on-page toast (LeetHub-style visible feedback).
"use strict";
function clToast(text, ok = true) {
  try {
    const t = document.createElement("div");
    t.textContent = text;
    t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:2147483647;
      background:${ok ? "#1f6f36" : "#8a2f2b"};color:#fff;padding:10px 16px;
      border-radius:10px;font:600 13px -apple-system,sans-serif;
      box-shadow:0 4px 14px rgba(0,0,0,.4);opacity:0;transition:opacity .3s`;
    document.body.appendChild(t);
    requestAnimationFrame(() => (t.style.opacity = "1"));
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 3500);
  } catch { /* cosmetic only */ }
}
