// CodeLog — LeetCode detector (v3, battle-tested endpoint).
// Strategy: poll LeetCode's classic REST endpoint /api/submissions/ (same-origin,
// your session) — it returns your recent submissions INCLUDING the code.
// Any accepted submission newer than our baseline -> sync. Zero UI dependence.
"use strict";

(() => {
  let baselineTs = null;   // newest submission timestamp seen at arm time
  let busy = false;
  const syncedIds = new Set();

  function log(...a) { console.info("[CodeLog:lc]", ...a); }

  async function recentSubmissions() {
    const res = await fetch("https://leetcode.com/api/submissions/?offset=0&limit=20", {
      credentials: "include",
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(`submissions endpoint ${res.status}`);
    const d = await res.json();
    return d.submissions_dump || [];
  }

  async function questionMeta(slug) {
    try {
      const res = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: `query q($s: String!) { question(titleSlug: $s) {
                    questionFrontendId title difficulty topicTags { name } } }`,
          variables: { s: slug },
        }),
      });
      return (await res.json())?.data?.question || null;
    } catch { return null; }
  }

  async function arm() {
    try {
      const subs = await recentSubmissions();
      baselineTs = subs.length ? subs[0].timestamp : 0;
      log(`armed (baseline ts: ${baselineTs}, recent subs seen: ${subs.length})`);
    } catch (e) {
      baselineTs = 0;
      log("arm failed (logged in?)", e.message);
    }
  }

  async function check() {
    if (busy || document.hidden || baselineTs === null) return;
    busy = true;
    try {
      const subs = await recentSubmissions();
      for (const s of subs) {
        if (s.timestamp <= baselineTs) break;              // older than baseline
        if (s.status_display !== "Accepted") continue;      // accepted-only
        if (syncedIds.has(s.id)) continue;
        syncedIds.add(s.id);
        await syncSubmission(s);
      }
      if (subs.length && subs[0].timestamp > baselineTs) baselineTs = subs[0].timestamp;
    } catch (e) {
      console.warn("[CodeLog:lc]", e);
    } finally {
      busy = false;
    }
  }

  async function syncSubmission(s) {
    const slug = s.title_slug || (s.url || "").split("/problems/")[1]?.split("/")[0] || "";
    const q = slug ? await questionMeta(slug) : null;
    const tags = q ? (q.topicTags || []).map((t) => t.name) : [];
    const payload = {
      platform: "leetcode",
      id: q?.questionFrontendId || slug || String(s.id),
      name: q?.title || s.title || slug,
      url: `https://leetcode.com/problems/${slug}/`,
      code: s.code,
      lang: s.lang,
      ext: clExtFor(s.lang),
      tags,
      topic: clPickTopic(tags),
      difficulty: q?.difficulty || null,
    };
    log("accepted detected:", payload.id, payload.name, "→ syncing");
    const resp = await B.runtime.sendMessage({ type: "codelog:solved", payload });
    if (resp && resp.ok) {
      clToast(resp.skipped ? "🏴‍☠️ CodeLog: already synced" : `🏴‍☠️ CodeLog: synced ✓ ${payload.name}`);
      log("synced ✓", resp);
    } else {
      clToast(`CodeLog: sync failed — ${resp?.error || resp?.reason || "see console"}`, false);
      console.warn("[CodeLog:lc] sync response", resp);
    }
  }

  arm();
  setInterval(check, 6000);
  log("content script loaded (v3, /api/submissions/ polling)");
})();
