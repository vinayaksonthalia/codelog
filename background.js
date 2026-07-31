// CodeLog background — receives "solved" events from content scripts and
// commits the solution to the user's GitHub repo via the Contents API.
//
// Design rules:
//   - Accepted-only: content scripts only fire on a full Accepted/OK verdict.
//   - One fine-grained token, one repo. We never touch anything else.
//   - Organized topic-wise (platform/topic/id-name/) AND day-wise (log/YYYY-MM-DD.md).
//   - Dedup: identical code is skipped; improved code updates in place.
//   - Failures queue locally and retry on the next event or browser start.
"use strict";
const B = globalThis.browser ?? globalThis.chrome;

const API = "https://api.github.com";

// ---------- storage helpers ----------
async function getCfg() {
  const d = await B.storage.local.get(["token", "owner", "repo", "branch"]);
  return d && d.token && d.owner && d.repo ? d : null;
}
async function getState(key, fallback) {
  const d = await B.storage.local.get(key);
  return d[key] ?? fallback;
}
async function setState(obj) { await B.storage.local.set(obj); }

// ---------- GitHub API ----------
async function gh(cfg, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${cfg.token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error("Bad GitHub token (401). Re-check it in CodeLog options.");
  if (res.status === 403 || res.status === 429) throw new Error("GitHub rate-limited (403/429). Will retry later.");
  if (res.status === 404 && method === "GET") return null; // file/branch doesn't exist yet
  if (!res.ok) throw new Error(`GitHub ${method} ${path} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// UTF-8 safe base64 (btoa alone breaks on non-ASCII).
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function unb64(b) {
  const bin = atob(b.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function resolveBranch(cfg) {
  if (cfg.branch) return cfg.branch;
  const repo = await gh(cfg, "GET", `/repos/${cfg.owner}/${cfg.repo}`);
  if (!repo) throw new Error(`Repo ${cfg.owner}/${cfg.repo} not found (check name + token repo access).`);
  return repo.default_branch || "main";
}

// Create or update one file. Retries once on a 409/422 sha conflict.
async function putFile(cfg, branch, path, content, message) {
  const encPath = path.split("/").map(encodeURIComponent).join("/");
  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await gh(cfg, "GET",
      `/repos/${cfg.owner}/${cfg.repo}/contents/${encPath}?ref=${encodeURIComponent(branch)}`);
    if (existing && existing.content !== undefined && unb64(existing.content) === content) {
      return { skipped: true }; // identical — dedup
    }
    const body = { message, content: b64(content), branch };
    if (existing && existing.sha) body.sha = existing.sha;
    try {
      await gh(cfg, "PUT", `/repos/${cfg.owner}/${cfg.repo}/contents/${encPath}`, body);
      return { updated: !!existing };
    } catch (e) {
      if (attempt === 0 && /409|422/.test(String(e.message))) continue; // stale sha — refetch once
      throw e;
    }
  }
}

// Append a line to today's day-wise log (read-modify-write).
async function appendDailyLog(cfg, branch, entryLine, dateStr) {
  const path = `log/${dateStr}.md`;
  const encPath = path.split("/").map(encodeURIComponent).join("/");
  const existing = await gh(cfg, "GET",
    `/repos/${cfg.owner}/${cfg.repo}/contents/${encPath}?ref=${encodeURIComponent(branch)}`);
  let content = existing ? unb64(existing.content) : `# ${dateStr}\n\n`;
  if (content.includes(entryLine)) return; // same problem already logged today
  content += entryLine + "\n";
  const body = { message: `log: ${dateStr}`, content: b64(content), branch };
  if (existing) body.sha = existing.sha;
  await gh(cfg, "PUT", `/repos/${cfg.owner}/${cfg.repo}/contents/${encPath}`, body);
}

// ---------- the sync pipeline ----------
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function handleSolved(msg) {
  // msg: {platform, id, name, url, code, lang, ext, tags[], topic, difficulty}
  const cfg = await getCfg();
  if (!cfg) { notify("CodeLog not configured", "Open CodeLog options and add your GitHub token + repo."); return { ok: false, reason: "unconfigured" }; }
  if (!msg.code || !msg.code.trim()) return { ok: false, reason: "empty code" };
  const plats = await getState("platforms", null);
  if (plats && plats[msg.platform] === false) return { ok: false, reason: "platform disabled" };

  const branch = await resolveBranch(cfg);
  const date = todayStr();
  const slug = msg.name ? msg.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : "problem";
  const folder = `${msg.platform}/${msg.topic || "uncategorized"}/${msg.id}-${slug}`;
  const solPath = `${folder}/solution.${msg.ext || "txt"}`;

  // Remember first-solve date across re-submissions.
  const solved = await getState("solved", {});
  const key = `${msg.platform}-${msg.id}`;
  const firstDate = solved[key]?.date || date;

  const commitMsg = `${msg.platform.toUpperCase()} ${msg.id} [${msg.topic}]: ${msg.name} — ${date}`;
  const res = await putFile(cfg, branch, solPath, msg.code, commitMsg);
  if (res.skipped) return { ok: true, skipped: true };

  const readme =
    `# ${msg.id} — ${msg.name}\n\n` +
    `- **Link:** ${msg.url}\n` +
    `- **Difficulty / Rating:** ${msg.difficulty ?? "—"}\n` +
    `- **Tags:** ${(msg.tags || []).join(", ") || "—"}\n` +
    `- **Language:** ${msg.lang || "—"}\n` +
    `- **Solved:** ${firstDate}\n\n` +
    `*Synced by [CodeLog](https://github.com/vinayaksonthalia/codelog).*\n`;
  await putFile(cfg, branch, `${folder}/README.md`, readme, `docs: ${msg.platform} ${msg.id}`);

  await appendDailyLog(cfg, branch,
    `- **[${msg.platform.toUpperCase()} ${msg.id}](${msg.url})** ${msg.name} · \`${msg.topic}\` · ${msg.difficulty ?? ""}`, date);

  solved[key] = { name: msg.name, topic: msg.topic, date: firstDate };
  const count = (await getState("syncCount", 0)) + 1;
  const recent = await getState("recent", []);
  recent.unshift({ t: Date.now(), label: `${msg.platform.toUpperCase()} ${msg.id} ${msg.name}` });
  await setState({ solved, syncCount: count, recent: recent.slice(0, 10) });

  notify("Solution synced ✓", `${msg.platform.toUpperCase()} ${msg.id}: ${msg.name} → ${msg.topic}/`);
  return { ok: true };
}

// ---------- retry queue ----------
async function enqueue(msg) {
  const q = await getState("pending", []);
  if (!q.some((m) => m.platform === msg.platform && m.id === msg.id)) q.push(msg);
  await setState({ pending: q.slice(-25) });
}
async function flushQueue() {
  const q = await getState("pending", []);
  if (!q.length) return;
  const remain = [];
  for (const m of q) {
    try { await handleSolved(m); }
    catch { remain.push(m); }
  }
  await setState({ pending: remain });
}

function notify(title, message) {
  try {
    B.notifications.create({ type: "basic", iconUrl: B.runtime.getURL("icon128.png"), title, message });
  } catch { /* notifications are best-effort */ }
}

// ---------- wiring ----------
B.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "codelog:solved") {
    handleSolved(msg.payload)
      .then((r) => { flushQueue(); sendResponse(r); })
      .catch(async (e) => {
        console.error("[CodeLog]", e);
        await enqueue(msg.payload);
        notify("CodeLog: sync failed — queued", String(e.message).slice(0, 120));
        sendResponse({ ok: false, queued: true, error: String(e.message) });
      });
    return true; // async response
  }
  if (msg && msg.type === "codelog:test") {
    (async () => {
      const cfg = await getCfg();
      if (!cfg) return sendResponse({ ok: false, error: "Not configured" });
      try {
        const branch = await resolveBranch(cfg);
        sendResponse({ ok: true, branch });
      } catch (e) { sendResponse({ ok: false, error: String(e.message) }); }
    })();
    return true;
  }
});

B.runtime.onStartup?.addListener(() => flushQueue());
