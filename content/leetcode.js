// CodeLog — LeetCode detector.
// Strategy: watch the DOM for the "Accepted" submission result, then use
// LeetCode's own GraphQL API (same-origin, your session) to fetch the exact
// submitted code + problem metadata. No scraping walls, accepted-only by design.
"use strict";

(() => {
  let lastSyncedSubmission = null;
  let busy = false;

  const slugFromUrl = () => {
    const m = location.pathname.match(/\/problems\/([^/]+)/);
    return m ? m[1] : null;
  };

  async function gql(query, variables) {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      credentials: "include",
    });
    return (await res.json()).data;
  }

  async function fetchQuestion(slug) {
    const d = await gql(
      `query q($s: String!) { question(titleSlug: $s) {
         questionFrontendId title difficulty topicTags { name } } }`, { s: slug });
    return d && d.question;
  }

  async function fetchLatestAcceptedSubmission(slug) {
    const d = await gql(
      `query s($s: String!) { questionSubmissionList(
         offset: 0, limit: 5, questionSlug: $s) {
         submissions { id statusDisplay lang { name verboseName } timestamp } } }`,
      { s: slug });
    const subs = d?.questionSubmissionList?.submissions || [];
    return subs.find((x) => x.statusDisplay === "Accepted") || null;
  }

  async function fetchSubmissionCode(id) {
    const d = await gql(
      `query d($id: Int!) { submissionDetails(submissionId: $id) {
         code lang { name verboseName } } }`, { id: Number(id) });
    return d && d.submissionDetails;
  }

  async function onAccepted() {
    if (busy) return;
    busy = true;
    try {
      const slug = slugFromUrl();
      if (!slug) return;
      const sub = await fetchLatestAcceptedSubmission(slug);
      if (!sub || sub.id === lastSyncedSubmission) return;
      const [q, det] = await Promise.all([fetchQuestion(slug), fetchSubmissionCode(sub.id)]);
      if (!q || !det || !det.code) return;
      lastSyncedSubmission = sub.id;
      const tags = (q.topicTags || []).map((t) => t.name);
      const langName = det.lang?.verboseName || det.lang?.name || sub.lang?.name || "";
      B.runtime.sendMessage({
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
    } catch (e) {
      console.warn("[CodeLog:lc]", e);
    } finally {
      busy = false;
    }
  }

  // Detect the result element. Primary: LeetCode's e2e locator. Fallback: any
  // freshly-added node whose text is exactly "Accepted" (result banner).
  const observer = new MutationObserver((muts) => {
    for (const mut of muts) {
      for (const node of mut.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const el =
          node.matches?.('[data-e2e-locator="submission-result"]') ? node :
          node.querySelector?.('[data-e2e-locator="submission-result"]');
        const txt = (el?.textContent || node.textContent || "").trim();
        if (el && /^Accepted$/.test(el.textContent.trim())) { onAccepted(); return; }
        if (!el && /^Accepted$/.test(txt) && node.childElementCount <= 3) { onAccepted(); return; }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
