// CodeLog — CSES detector.
// Strategy: on a submission result page (/problemset/result/<id>/), wait until
// the final verdict is ACCEPTED, read the code straight off the page, and
// resolve the task's topic from the problemset index (fetched once, cached).
"use strict";

(() => {
  let fired = false;

  async function sectionMap() {
    const cached = await B.storage.local.get("csesSections");
    if (cached.csesSections && cached.csesSectionsAt &&
        Date.now() - cached.csesSectionsAt < 7 * 864e5) {
      return cached.csesSections;
    }
    const res = await fetch("https://cses.fi/problemset/", { credentials: "include" });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const map = {};
    let current = "uncategorized";
    for (const el of doc.querySelectorAll("h2, a[href^='/problemset/task/']")) {
      if (el.tagName === "H2") current = el.textContent.trim();
      else {
        const m = el.getAttribute("href").match(/task\/(\d+)/);
        if (m) map[m[1]] = { section: current, name: el.textContent.trim() };
      }
    }
    await B.storage.local.set({ csesSections: map, csesSectionsAt: Date.now() });
    return map;
  }

  function pageVerdictAccepted() {
    // Result pages show a summary table with "Verdict:" row; final verdict must
    // be ACCEPTED (partial/other verdicts must not sync).
    for (const td of document.querySelectorAll("td, .summary-table td, .task-score")) {
      const t = td.textContent.trim();
      if (/^ACCEPTED$/.test(t)) return true;
    }
    return false;
  }

  function extractCode() {
    const pre = document.querySelector("pre.prettyprint, pre.linenums, pre");
    return pre ? pre.textContent : null;
  }

  function extractTaskLink() {
    const a = document.querySelector("a[href^='/problemset/task/']");
    if (!a) return null;
    const m = a.getAttribute("href").match(/task\/(\d+)/);
    return m ? { id: m[1], name: a.textContent.trim() } : null;
  }

  function extractLang() {
    for (const td of document.querySelectorAll("td")) {
      const t = td.textContent.trim();
      if (/^(C\+\+\d*|Python\d?|Java|Rust|Node\.js|Pascal)/i.test(t) && t.length < 20) return t;
    }
    return "";
  }

  async function trySync() {
    if (fired) return;
    if (!/\/(problemset|contest)\/result\//.test(location.pathname)) return;
    if (!pageVerdictAccepted()) return;
    const task = extractTaskLink();
    const code = extractCode();
    if (!task || !code) return;
    fired = true;
    try {
      const map = await sectionMap();
      const section = map[task.id]?.section || "uncategorized";
      const name = map[task.id]?.name || task.name || `CSES ${task.id}`;
      const lang = extractLang();
      const resp = await B.runtime.sendMessage({
        type: "codelog:solved",
        payload: {
          platform: "cses",
          id: task.id,
          name,
          url: `https://cses.fi/problemset/task/${task.id}`,
          code,
          lang,
          ext: clExtFor(lang),
          tags: [section],
          topic: clSlugify(section),
          difficulty: null,
        },
      });
      if (resp && resp.ok) {
        clToast(resp.skipped ? "🏴‍☠️ CodeLog: already synced" : `🏴‍☠️ CodeLog: synced ✓ ${name}`);
        console.info("[CodeLog:cses] synced", task.id, name, resp);
      } else {
        clToast(`CodeLog: sync failed — ${resp?.error || resp?.reason || "see console"}`, false);
        console.warn("[CodeLog:cses] sync response", resp);
      }
    } catch (e) {
      console.warn("[CodeLog:cses]", e);
      fired = false;
    }
  }

  // Verdict appears after tests finish — poll the DOM briefly, then observe.
  const observer = new MutationObserver(() => trySync());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  trySync();
  const iv = setInterval(() => { trySync(); if (fired) clearInterval(iv); }, 1500);
  setTimeout(() => clearInterval(iv), 90000);
})();
