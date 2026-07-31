"use strict";
const $ = (id) => document.getElementById(id);
const status = (msg, cls) => { const s = $("status"); s.textContent = msg; s.className = cls || ""; };

const PLATFORMS = ["leetcode", "codeforces", "cses"];

async function load() {
  const d = await B.storage.local.get(["token", "owner", "repo", "branch", "platforms"]);
  if (d.token) $("token").value = d.token;
  if (d.owner) $("owner").value = d.owner;
  if (d.repo) $("repo").value = d.repo;
  if (d.branch) $("branch").value = d.branch;
  const p = d.platforms || {};
  PLATFORMS.forEach((k) => { $("p-" + k).checked = p[k] !== false; });
}

$("save").addEventListener("click", async () => {
  const token = $("token").value.trim();
  const owner = $("owner").value.trim();
  const repo = $("repo").value.trim();
  const branch = $("branch").value.trim();
  if (!token || !owner || !repo) return status("Token, username and repo are required.", "err");
  if (!/^github_pat_|^ghp_/.test(token)) return status("That doesn't look like a GitHub token (github_pat_… or ghp_…).", "err");
  const platforms = {};
  PLATFORMS.forEach((k) => { platforms[k] = $("p-" + k).checked; });
  await B.storage.local.set({ token, owner, repo, branch, platforms });
  status("Saved ✓ — now hit Test connection.", "ok");
});

$("test").addEventListener("click", async () => {
  status("Testing…");
  const r = await B.runtime.sendMessage({ type: "codelog:test" });
  if (r && r.ok) status(`Connected ✓ — repo reachable, branch: ${r.branch}. Go solve something!`, "ok");
  else status(`Failed: ${r ? r.error : "no response"}`, "err");
});

load();
