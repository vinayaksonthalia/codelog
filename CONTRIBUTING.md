# Contributing to CodeLog

The #1 wanted contribution: **a new platform adapter** (GeeksforGeeks, AtCoder, HackerRank, Codechef…). Each platform is one content script — you never need to touch the core.

## Add a platform in 4 steps

1. **Create `content/<platform>.js`.** Copy `content/cses.js` as the template. Your script must:
   - Detect a **fully accepted** verdict on the page (never partial, never wrong-answer).
   - Extract: problem `id`, `name`, `url`, the submitted `code`, `lang`, and `tags` (or a category).
   - Send one message:
     ```js
     B.runtime.sendMessage({ type: "codelog:solved", payload: {
       platform: "<platform>", id, name, url, code, lang,
       ext: clExtFor(lang), tags, topic: clPickTopic(tags), difficulty,
     }});
     ```
   - Guard against double-firing (see the `fired`/`synced` patterns in existing adapters).
2. **Register it in `manifest.json`** — a `content_scripts` entry + `host_permissions` for the domain.
3. **Add the toggle** — one checkbox in `options/options.html`, add the key to `PLATFORMS` in `options/options.js`.
4. **Test**: load the extension, solve an easy problem on the platform, confirm the commit lands in the right folder, then a second submit of the same code is skipped (dedup).

## Ground rules

- **Accepted-only is sacred.** If a platform reports partial scores, sync only on 100%.
- **Session-side only.** Use the user's own logged-in session (same-origin fetches). Never proxy through third parties, never send data anywhere except `api.github.com`.
- **No new permissions** beyond the platform's own domain.
- **Fail quietly, log clearly** — `console.warn("[CodeLog:xx]", e)`; never break the host page.

## Dev setup

No build step. Edit files → reload the extension (`about:debugging` / `chrome://extensions` → reload). Run logic tests: `node test/topics.test.js`.

## Selector breakage (the maintenance reality)

Platforms redesign their UIs. If detection breaks, the fix is usually one selector in one adapter — perfect first PR. Open an issue with the page HTML snippet and we'll ship it fast.
