// CodeLog — LeetCode detector (v4).
// Learned from LeetHub 2.0 (MIT): after a submit, LeetCode's SPA navigates to
// /problems/<slug>/submissions/<id>/ — the submission id is IN THE URL.
// Primary path: watch the URL for a new submission id -> query GraphQL
// submissionDetails(id) (one call: status + code + question + tags) -> if
// statusCode === 10 (Accepted) -> sync. Fallback: poll /api/submissions/.
"use strict";

(() => {
  const seenIds = new Set();
  let baselineTs = null;
  let busy = false;

  const log = (...a) => console.info("[CodeLog:lc]", ...a);

  // ---------- shared: send to background ----------
  async function send(payload) {
    const resp = await B.runtime.sendMessage({ type: "codelog:solved", payload });
    if (resp && resp.ok) {
      clToast(resp.skipped ? "🏴‍☠️ CodeLog: already synced" : `🏴‍☠️ CodeLog: synced ✓ ${payload.name}`);
      log("synced ✓", payload.id, payload.name);
    } else {
      clToast(`CodeLog: sync failed — ${resp?.error || resp?.reason || "see console"}`, false);
      console.warn("[CodeLog:lc] sync response", resp);
    }
  }

  async function gql(body) {
    const res = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    return (await res.json()).data;
  }

  async function frontendId(slug) {
    try {
      const d = await gql({
        query: `query q($s: String!) { question(titleSlug: $s) { questionFrontendId } }`,
        variables: { s: slug },
      });
      return d?.question?.questionFrontendId || null;
    } catch { return null; }
  }

  // ---------- PRIMARY: url watcher (the LeetHub trick) ----------
  async function handleSubmissionId(id, attempt = 0) {
    if (seenIds.has(id)) return;
    if (attempt === 0) log("submission detected in URL:", id);
    try {
      const d = await gql({
        query: `query s($id: Int!) { submissionDetails(submissionId: $id) {
                  statusCode code timestamp lang { name verboseName }
                  question { questionFrontendId title titleSlug difficulty
                             topicTags { name } } } }`,
        variables: { id: Number(id) },
      });
      const det = d?.submissionDetails;
      if (!det) { // may not be ready yet — retry up to ~30s
        if (attempt < 15) setTimeout(() => handleSubmissionId(id, attempt + 1), 2000);
        else log("gave up on submission", id, "(no details — judging too long or not yours)");
        return;
      }
      if (det.statusCode !== 10) { // 10 = Accepted; anything else = not accepted
        if (det.statusCode === undefined || det.statusCode === null || det.statusCode === 0) {
          if (attempt < 15) setTimeout(() => handleSubmissionId(id, attempt + 1), 2000);
          return;
        }
        seenIds.add(id);
        log("submission", id, "not accepted (statusCode", det.statusCode + ") — ignoring");
        return;
      }
      seenIds.add(id);
      const q = det.question || {};
      const slug = q.titleSlug || location.pathname.match(/\/problems\/([^/]+)/)?.[1] || "";
      const tags = (q.topicTags || []).map((t) => t.name);
      const fid = q.questionFrontendId || (await frontendId(slug)) || slug;
      await send({
        platform: "leetcode",
        id: fid,
        name: q.title || slug,
        url: `https://leetcode.com/problems/${slug}/`,
        code: det.code,
        lang: det.lang?.verboseName || det.lang?.name || "",
        ext: clExtFor(det.lang?.name || ""),
        tags,
        topic: clPickTopic(tags),
        difficulty: q.difficulty || null,
      });
    } catch (e) {
      console.warn("[CodeLog:lc]", e);
    }
  }

  let lastUrl = "";
  function watchUrl() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    const m = location.href.match(/\/submissions\/(\d+)/);
    if (m) handleSubmissionId(m[1]);
  }

  // ---------- FALLBACK: /api/submissions/ poll (catches everything else) ----------
  async function pollFallback() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const res = await fetch("https://leetcode.com/api/submissions/?offset=0&limit=10", {
        credentials: "include", headers: { "Accept": "application/json" },
      });
      if (!res.ok) return;
      const subs = (await res.json()).submissions_dump || [];
      if (baselineTs === null) {
        baselineTs = subs.length ? subs[0].timestamp : 0;
        log(`fallback armed (baseline ts: ${baselineTs})`);
        return;
      }
      for (const s of subs) {
        if (s.timestamp <= baselineTs) break;
        if (s.status_display !== "Accepted" || seenIds.has(String(s.id))) continue;
        seenIds.add(String(s.id));
        const slug = s.title_slug || "";
        const fid = (await frontendId(slug)) || slug || String(s.id);
        // fallback has no tags — try question meta for them
        let tags = [];
        try {
          const d = await gql({
            query: `query q($s: String!) { question(titleSlug: $s) { topicTags { name } difficulty } }`,
            variables: { s: slug },
          });
          tags = (d?.question?.topicTags || []).map((t) => t.name);
        } catch { /* tags optional */ }
        await send({
          platform: "leetcode", id: fid, name: s.title || slug,
          url: `https://leetcode.com/problems/${slug}/`,
          code: s.code, lang: s.lang, ext: clExtFor(s.lang),
          tags, topic: clPickTopic(tags), difficulty: null,
        });
      }
      if (subs.length && subs[0].timestamp > baselineTs) baselineTs = subs[0].timestamp;
    } catch (e) {
      console.warn("[CodeLog:lc] fallback", e);
    } finally {
      busy = false;
    }
  }

  setInterval(watchUrl, 1000);   // primary — URL is the source of truth
  watchUrl();
  pollFallback();                // arms the baseline
  setInterval(pollFallback, 8000);
  log("content script loaded (v4: URL watcher + submissionDetails, fallback poll)");
})();
