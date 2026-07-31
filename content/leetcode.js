// CodeLog — LeetCode detector.
// Strategy: UI-independent. On problem pages we record the latest accepted
// submission id as a baseline, then poll LeetCode's own GraphQL (same-origin,
// your session) every few seconds; any NEW accepted submission id -> sync.
// A MutationObserver on the result banner gives an instant trigger when it
// works, but the poll guarantees detection even when the UI changes.
"use strict";

(() => {
  let baseline = null;        // latest accepted submission id seen at arm time
  let lastSynced = null;
  let busy = false;
  let armedSlug = null;

  const slugFromUrl = () => {
    const m = location.pathname.match(/\/problems\/([^/]+)/);
    return m ? m[1] : null;
  };

  function toast(text, ok = true) {
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

  async function gql(query, variables) {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      credentials: "include",
    });
    return (await res.json()).data;
  }

  async function latestAccepted(slug) {
    const d = await gql(
      `query s($s: String!) { questionSubmissionList(
         offset: 0, limit: 8, questionSlug: $s) {
         submissions { id statusDisplay lang { name verboseName } } } }`, { s: slug });
    const subs = d?.questionSubmissionList?.submissions || [];
    return subs.find((x) => x.statusDisplay === "Accepted") || null;
  }

  async function arm() {
    const slug = slugFromUrl();
    if (!slug || slug === armedSlug) return;
    armedSlug = slug;
    baseline = null;
    try {
      const sub = await latestAccepted(slug);
      baseline = sub ? sub.id : "none";
      console.info(`[CodeLog:lc] armed on '${slug}' (baseline submission: ${baseline})`);
    } catch (e) {
      baseline = "none";
      console.warn("[CodeLog:lc] arm failed (not logged in?)", e);
    }
  }

  async function sync(slug, sub) {
    const [qd, dd] = await Promise.all([
      gql(`query q($s: String!) { question(titleSlug: $s) {
             questionFrontendId title difficulty topicTags { name } } }`, { s: slug }),
      gql(`query d($id: Int!) { submissionDetails(submissionId: $id) {
             code lang { name verboseName } } }`, { id: Number(sub.id) }),
    ]);
    const q = qd?.question, det = dd?.submissionDetails;
    if (!q || !det || !det.code) throw new Error("could not fetch code/metadata");
    const tags = (q.topicTags || []).map((t) => t.name);
    const langName = det.lang?.verboseName || det.lang?.name || "";
    const resp = await B.runtime.sendMessage({
      type: "codelog:solved",
      payload: {
        platform: "leetcode",
        id: q.questionFrontendId,
        name: q.title,
        url: `https://leetcode.com/problems/${slug}/`,
        code: det.code,
        lang: langName,
        ext: clExtFor(det.lang?.name || langName),
        tags,
        topic: clPickTopic(tags),
        difficulty: q.difficulty,
      },
    });
    if (resp && resp.ok) {
      toast(resp.skipped ? "🏴‍☠️ CodeLog: already synced" : `🏴‍☠️ CodeLog: synced ✓ ${q.title}`);
      console.info("[CodeLog:lc] synced", q.questionFrontendId, q.title, resp);
    } else {
      toast(`CodeLog: sync failed — ${resp?.error || resp?.reason || "see console"}`, false);
      console.warn("[CodeLog:lc] sync response", resp);
    }
  }

  async function check() {
    if (busy || document.hidden) return;
    const slug = slugFromUrl();
    if (!slug) return;
    if (slug !== armedSlug) await arm();
    if (baseline === null) return; // arming in flight
    busy = true;
    try {
      const sub = await latestAccepted(slug);
      if (sub && sub.id !== baseline && sub.id !== lastSynced) {
        lastSynced = sub.id;
        baseline = sub.id;
        await sync(slug, sub);
      }
    } catch (e) {
      console.warn("[CodeLog:lc]", e);
    } finally {
      busy = false;
    }
  }

  // Instant trigger when the result banner appears; the poll is the guarantee.
  const observer = new MutationObserver((muts) => {
    for (const mut of muts) {
      for (const node of mut.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const txt = (node.textContent || "").trim();
        if (txt.startsWith("Accepted")) { setTimeout(check, 1200); return; }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  arm();
  setInterval(check, 7000); // the safety net — UI-independent
  console.info("[CodeLog:lc] content script loaded");
})();
