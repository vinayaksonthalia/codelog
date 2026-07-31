"use strict";
(async () => {
  const d = await B.storage.local.get(["syncCount", "recent", "owner", "repo", "pending"]);
  document.getElementById("count").textContent = d.syncCount || 0;
  const list = document.getElementById("list");
  const items = d.recent || [];
  if (items.length) {
    list.innerHTML = items.map((r) =>
      `<div class="item">${r.label} <span class="muted">· ${new Date(r.t).toLocaleDateString()}</span></div>`).join("");
  }
  if (d.pending && d.pending.length) {
    list.innerHTML += `<div class="item muted">⏳ ${d.pending.length} queued (will retry)</div>`;
  }
  document.getElementById("opts").addEventListener("click", () => B.runtime.openOptionsPage());
  const repoLink = document.getElementById("repo");
  if (d.owner && d.repo) repoLink.href = `https://github.com/${d.owner}/${d.repo}`;
  else repoLink.addEventListener("click", () => B.runtime.openOptionsPage());
})();
