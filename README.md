# CodeLog 🏴‍☠️

**Every Accepted solution → a real commit in *your* GitHub repo. Automatically.**
LeetCode · Codeforces · CSES — organized by topic *and* by day. No accounts, no server, no AI in between. Your token, one repo, nothing else.

> Solve → see **Accepted** → CodeLog commits `leetcode/dynamic-programming/322-coin-change/solution.cpp` + updates `log/2026-08-01.md`. Green square earned, portfolio organized, zero effort.

## Why CodeLog exists

Existing sync tools ask for OAuth access to **all your repositories — public and private**. Read that again. A LeetCode helper that can read and write your company's private repos, your journal, everything.

CodeLog refuses that model:

## 🔐 The security model (the whole point)

- **You create a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens) scoped to ONE repo** with a single permission (Contents: read/write). It *physically cannot* touch any other repo. GitHub enforces this, not us.
- **The token never leaves your browser.** Stored in local extension storage, sent only to `api.github.com`. No CodeLog server exists. No analytics, no telemetry, no tracking.
- **Minimal host permissions** — the extension can only run on the three platforms + the GitHub API.
- **Accepted-only** — it fires exclusively on a full Accepted/OK verdict. Wrong answers never touch your repo.
- **Why no "Login with GitHub"?** OAuth apps get the coarse all-repos `repo` scope — the exact problem above. A per-repo OAuth flow requires a hosted backend (a server you'd have to trust). The fine-grained token is the *most* secure zero-server design, not a shortcut. (A GitHub-App flow is on the roadmap for one-click setup.)

## ✨ What it does

- **Auto-commit on Accepted** for LeetCode, Codeforces, CSES — pick any combination in settings; you're not bound to all three.
- **Topic-organized**: `platform/topic/id-name/solution.ext` + a README per problem (link, tags, difficulty/rating, language, first-solved date).
- **Day-wise log**: `log/YYYY-MM-DD.md` — what you solved each day, auto-appended. Your streak, documented.
- **Dedup & improve**: identical code is skipped; a better solution updates in place; the original solved date is preserved.
- **Offline-resilient**: failed syncs queue locally and retry.
- **Multi-language**: `solution.cpp` and `solution.py` for the same problem coexist.

## 🚀 Install (2 minutes)

**Firefox (temporary, for now):**
1. `about:debugging` → *This Firefox* → **Load Temporary Add-on…** → select this folder's `manifest.json`.

**Chrome / Edge / Brave:**
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this folder.

**Then configure (once):**
1. Create the token: GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate → Repository access: **Only select repositories** → your solutions repo → Permissions: **Contents → Read and write** → Generate & copy.
2. Click the CodeLog icon → ⚙️ Settings → paste token + username + repo → **Save** → **Test connection**.
3. Solve something. Watch the commit appear.

*(Store listings — Firefox AMO & Chrome Web Store — coming once v0.1 is battle-tested.)*

## 🧭 How detection works (per platform)

| Platform | Accepted detection | Code retrieval | Topic source |
|---|---|---|---|
| LeetCode | submission result in the page | LeetCode's own GraphQL (your session) | `topicTags` |
| Codeforces | verdict cell turns *Accepted* | CF's `submitSource` (your session) | API `tags` (+ rating in README) |
| CSES | result page shows *ACCEPTED* | code on the result page | problemset section (cached weekly) |

Everything runs inside **your** logged-in browser — which is why CodeLog works where external scrapers hit walls.

> **Note (Codeforces):** visiting your *My Submissions* page also backfills recent accepted solutions visible on that page — a feature for bootstrapping your repo, worth knowing about.

## 🗺️ Roadmap

- [ ] GeeksforGeeks & AtCoder adapters (see CONTRIBUTING — one file each)
- [ ] Firefox AMO + Chrome Web Store listings
- [ ] Stats page in the repo (auto-generated summary, Codolio-style)
- [ ] Optional GitHub-App auth for one-click setup

## 🤝 Contributing

Each platform is **one self-contained content script** — adding a platform needs zero knowledge of the core. See [CONTRIBUTING.md](CONTRIBUTING.md). PRs for new platforms, better selectors, and languages are very welcome.

## License

MIT
