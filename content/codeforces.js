// CodeLog — Codeforces detector.
// Strategy: on status/my-submissions pages, watch verdict cells; when one
// becomes "Accepted", pull the source via CF's own /data/submitSource
// (same-origin + your session + csrf token — the wall that blocks external
// scrapers doesn't exist inside your browser). Metadata via the public API.
"use strict";

(() => {
  const synced = new Set();

  const csrf = () =>
    document.querySelector("meta[name='X-Csrf-Token']")?.content ||
    document.querySelector("input[name='csrf_token']")?.value || "";

  async function fetchSource(submissionId) {
    const res = await fetch("https://codeforces.com/data/submitSource", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `submissionId=${submissionId}&csrf_token=${encodeURIComponent(csrf())}`,
      credentials: "include",
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d && d.source ? d : null;
  }

  async function fetchProblemMeta(contestId, index) {
    try {
      const res = await fetch("https://codeforces.com/api/problemset.problems?lang=en");
      const d = await res.json();
      if (d.status === "OK") {
        const p = d.result.problems.find(
          (x) => String(x.contestId) === String(contestId) && x.index === index);
        if (p) return p;
      }
    } catch { /* fall through */ }
    return null;
  }

  function parseRow(row) {
    const sid = row.getAttribute("data-submission-id");
    const probLink = row.querySelector("td[data-problemid] a, a[href*='/problem/']");
    if (!sid || !probLink) return null;
    const href = probLink.getAttribute("href") || "";
    const m = href.match(/\/(?:contest|gym|problemset\/problem)\/(\d+)(?:\/problem)?\/([A-Za-z]\d*)/);
    if (!m) return null;
    return { sid, contestId: m[1], index: m[2].toUpperCase(), nameGuess: probLink.textContent.trim() };
  }

  async function onAccepted(row) {
    const info = parseRow(row);
    if (!info || synced.has(info.sid)) return;
    synced.add(info.sid);
    try {
      const [src, meta] = await Promise.all([
        fetchSource(info.sid),
        fetchProblemMeta(info.contestId, info.index),
      ]);
      if (!src || !src.source) { synced.delete(info.sid); return; }
      const tags = meta?.tags || [];
      const name = meta?.name || info.nameGuess.replace(/^[A-Z]\d*\s*-\s*/, "") || `${info.contestId}${info.index}`;
      const resp = await B.runtime.sendMessage({
        type: "codelog:solved",
        payload: {
          platform: "codeforces",
          id: `${info.contestId}${info.index}`,
          name,
          url: `https://codeforces.com/contest/${info.contestId}/problem/${info.index}`,
          code: src.source,
          lang: src.prettifyClass || src.programTypeId || "",
          ext: clExtFor(src.prettifyClass === "lang-cpp" ? "cpp" :
                        src.prettifyClass === "lang-py" ? "python" :
                        src.prettifyClass === "lang-java" ? "java" : ""),
          tags,
          topic: clPickTopic(tags),
          difficulty: meta?.rating ?? null,
        },
      });
      if (resp && resp.ok) {
        clToast(resp.skipped ? "🏴‍☠️ CodeLog: already synced" : `🏴‍☠️ CodeLog: synced ✓ ${name}`);
        console.info("[CodeLog:cf] synced", info.contestId + info.index, name, resp);
      } else {
        clToast(`CodeLog: sync failed — ${resp?.error || resp?.reason || "see console"}`, false);
        console.warn("[CodeLog:cf] sync response", resp);
      }
    } catch (e) {
      console.warn("[CodeLog:cf]", e);
      synced.delete(info.sid);
    }
  }

  function scan() {
    document.querySelectorAll("tr[data-submission-id]").forEach((row) => {
      const verdict = row.querySelector(".verdict-accepted, span.verdict-accepted");
      if (verdict) onAccepted(row);
    });
  }

  // CF verdicts update live ("Running on test 5" -> "Accepted") — observe changes.
  const observer = new MutationObserver(() => scan());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  scan(); // also catch already-accepted rows on page load (e.g. /problemset/status/my)
  setInterval(scan, 7000); // safety net for live verdict updates the observer misses
  console.info("[CodeLog:cf] content script loaded");
})();
