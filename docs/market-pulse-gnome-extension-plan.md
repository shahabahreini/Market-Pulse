# Market Pulse — GNOME Shell Extension: Complete Build & Launch Plan

| Field | Value |
|---|---|
| **Product name** | Market Pulse |
| **Extension UUID** | `market-pulse@shahabahreini.github.com` |
| **GSettings schema** | `org.gnome.shell.extensions.market-pulse` |
| **Repository** | https://github.com/shahabahreini/market-pulse-gnome-extension |
| **License** | GPL-3.0 |
| **GNOME support** | 46, 47, 48, 49 |
| **Target release** | v1.0 — full feature set (all phases below) |
| **Reference project (ideas only)** | https://github.com/cinatic/stocks-extension ([EGO listing](https://extensions.gnome.org/extension/1422/stocks-extension/)) |

> ⚖️ **License & attribution:** The reference project is used strictly as a reference for ideas, feature inventory, and known-pitfall analysis. Market Pulse is a **new, clean-room extension**. Do not copy upstream code verbatim; credit the reference project in the README as inspiration.

---

## 0. Instructions for the AI Development Agent

### 0.0 Reference Material

- Treat **github.com/cinatic/stocks-extension** as the canonical reference implementation. Mine it for: feature inventory (Section 1.1), provider integration ideas (Yahoo Finance, Eastmoney), chart rendering approach, and — critically — its **documented failure modes** (EGO rejection history, settings-gear bug, fixed 10 s polling, no symbol search). Section 1.2 is your anti-pattern checklist.
- Also review comparable extensions for UX ideas: *Stonks* and *GNOME-Stocks* on extensions.gnome.org.
- Where this document conflicts with the reference implementation, **this document wins** — it encodes the corrections.

### 0.1 Mission

Build **Market Pulse**, a production-grade GNOME Shell panel extension for live stock and crypto quotes. It must:

1. Pass **extensions.gnome.org (EGO) review on the first submission**.
2. Run on **GNOME Shell 46–49** without version-specific hacks.
3. Feel like a **native GNOME product**: HIG-compliant, libadwaita preferences, calm/soft/minimal visuals.
4. Be **invisible in resource usage**: ~0% CPU idle, <15 MB RSS, no leaks, no jank.
5. Deliver the **complete** feature set in Sections 3–5 — all phases ship in v1.0.

### 0.2 Locked Project Decisions (Owner-Approved)

| # | Decision | Value |
|---|---|---|
| 1 | Project type | New clean-room extension (not a fork) |
| 2 | Author / GitHub | `shahabahreini` |
| 3 | Repo name | `market-pulse-gnome-extension` |
| 4 | Release scope | **All phases (1–5) ship in v1.0** |
| 5 | License | GPL-3.0 |
| 6 | GNOME versions | 46+ only (46, 47, 48, 49) |
| 7 | Charts | Custom **Cairo** rendering — soft coloring, smooth (animated) transitions |
| 8 | Price alerts | Session-bound: fire only while the extension is active; no daemon |
| 9 | Portfolio/P&L data | Stored **locally only** (GSettings); include "hide values" privacy toggle for screen-sharing |
| 10 | Providers | Registry of **all free, no-API-key providers**; multi-select in settings; **default: Yahoo + Eastmoney**; crypto providers included |
| 11 | Panel default | Ticker cycling **enabled by default** |
| 12 | Icon | Calm, soft, minimalistic pulse motif (assets delivered: `market-pulse-icon.svg`, `market-pulse-symbolic.svg`) |
| 13 | Sounds | None — default GNOME notification behavior only |
| 14 | SEO scope | Full coverage: repo SEO, AI-agent (GEO) indexing, EGO, landing page, distro packaging, launch posts; **crypto keywords included** |
| 15 | Demo assets | README screenshots section ships as a **blank placeholder**; owner adds screenshots after development |

### 0.3 Hard Rules (EGO Review Compliance — Non-Negotiable)

1. **Lifecycle hygiene (`disable()`):** destroy every `St`/`Clutter` actor, remove every `GLib.timeout`/`idle` source, disconnect **every** signal (GSettings, Shell, network monitor), cancel every in-flight Soup request, null all references. `disable()` must return the Shell to a byte-identical state. This was the historical cause of repeated EGO rejections in the reference project — treat it as the #1 code-review checkpoint.
2. **No blocking calls** on the main loop: no synchronous Soup, no synchronous file I/O in hot paths, no `while` polling.
3. **No external processes** (`GLib.spawn*`); write only inside the extension dir or sanctioned cache dir.
4. **`metadata.json`:** `shell-version: ["46","47","48","49"]`, semver `version`, `uuid: market-pulse@shahabahreini.github.com`.
5. **GSettings:** ship compilable `.gschema.xml` under `org.gnome.shell.extensions.market-pulse`; access via `extension.getSettings()`; never hard-code schema paths.
6. **No remote code, no telemetry, no minified/obfuscated source.**
7. **Error containment:** no exception may ever propagate uncaught into Shell's main loop (log via `console.error` with `[market-pulse]` prefix).

### 0.4 Code Quality Standards

- **Language:** modern GJS (ES2022+), classes, async/await. ESLint (`eslint-config-gnome` or equivalent), zero warnings in CI.
- **Architecture:**
  - `extension.js` — thin bootstrap only (enable/disable wiring).
  - `services/providers/` — **provider registry** behind a `QuoteProvider` interface. Ship adapters for every free, key-less provider validated at build time: **Yahoo Finance, Eastmoney** (defaults, enabled), plus candidates **Stooq** (equities/indices/FX CSV), **CoinGecko** free tier and **Binance public market data** (crypto), **Frankfurter** (ECB FX rates for currency conversion). Each adapter declares: asset classes, markets, rate limits, search support. Verify endpoint availability and terms during implementation; drop any that fail validation. Registry must make adding a provider a one-file change.
  - `services/` — polling scheduler (adaptive), alert engine, portfolio/P&L calculator, cache.
  - `components/` — UI: `panelTicker.js`, `stocksMenu.js`, `detailView.js`, `chart.js` (Cairo), `sparkline.js`.
  - `helpers/` — settings binding, `Intl`-based formatting, market-hours calendar, migration.
  - `prefs.js` + `ui/` — libadwaita preferences, one `Adw.PreferencesPage` per concern.
- **State:** single `Settings` helper with debounced change handlers; typed models `Symbol`, `Portfolio`, `Quote`, `Holding`, `Alert`; versioned GSettings migration framework (even though v1.0 is the first release, design for forward migration).
- **Caching:** in-memory quote cache + on-disk last-good-quotes JSON (offline grace). No fixed sub-minute polling anywhere.
- **Network resilience:** exponential backoff on 429/5xx, per-symbol error state, `GNetworkMonitor` integration, provider failover per Section 3.
- **Security & privacy:** HTTPS only; never log URLs with tokens; validate remote JSON against DTO shapes; holdings/quantities never leave the device.

### 0.5 Performance Budget (Enforced in CI)

| Metric | Budget |
|---|---|
| Idle CPU | ~0% (wakeups only on scheduled poll) |
| Resident memory (extension-attributable) | < 15 MB |
| Enable time | < 100 ms |
| Menu open render | < 50 ms, no dropped frames |
| Chart draw | lazy — only when visible; animations ≤ 250 ms, ease-out |
| Polling | 30–60 s during market hours, ≥15 min off-hours, suspended when locked/idle/offline |

CI: ESLint → schema validation → zip packaging → container matrix install on GNOME 46/47/48/49 → Sysprof/GJS heap smoke test for leaks and wakeup regressions.

### 0.6 UX Standards (GNOME HIG — Non-Negotiable)

1. **Preferences:** `Adw.PreferencesWindow`; pages: *General* (panel position, ticker behavior, display format), *Portfolios & Symbols*, *Providers* (multi-select list with per-provider description and asset-class badges), *Alerts*, *About*. `Adw.AlertDialog` for destructive actions; `Adw.Toast` for confirmations. No GTK3 widgets.
2. **Panel ticker:** fixed max width; soft fade transitions; pause-on-hover; click = next symbol; right-click = pin/pause; middle-click = refresh. Cycling enabled by default.
3. **Dropdown menu:** standard `PopupMenu` conventions; provider/status header; scrollable rows; bottom "Settings" item with separator; full keyboard navigation and `accessible-name`s.
4. **Color & motion:** theme-derived colors only; colorblind-safe blue/orange option; dark-style compliant; Cairo charts use **soft, low-saturation palette** with smooth ease-out animations; motion limited to short fades — the UI must feel quiet and calm.
5. **States:** every view designs its empty, loading (skeleton), error, and offline states — no blank UI ever.
6. **Typography & spacing:** 8-px grid, ellipsized names, honor text-scaling.

### 0.7 Deliverables (Definition of Done)

1. **Complete extension source** (ES modules; `make install` / EGO-ready zip).
2. **`metadata.json`** (46–49) and **GSettings schema** covering every option in Section 3.
3. **libadwaita preferences UI** implementing all settings, including the provider multi-select.
4. **Icon assets** (delivered with this plan): `market-pulse-icon.svg` (full color) and `market-pulse-symbolic.svg`; wire into metadata and EGO listing.
5. **README.md** per Section 7 structure, with the screenshots section left as a clearly marked placeholder (`<!-- TODO(owner): add screenshots/GIF after development -->`).
6. **CI workflow** (lint → schema → zip → 46–49 install matrix → perf smoke).
7. **CHANGELOG.md** (v1.0 entry), **GPL-3.0 LICENSE**, **llms.txt** (Section 7).
8. **Acceptance checklist** (Section 6) fully checked with evidence.

### 0.8 Working Method

- Build in phase order (Section 5); all phases land in v1.0 — do not skip ahead until current phase gates pass.
- After each Phase 1 item, run the lifecycle test: enable → exercise every feature → disable → 10×; assert zero leaks.
- Never regress carried-forward features (ticker, portfolios, charts, dual providers).
- Ambiguity tie-breaker: choose what is calmer, more conventional for GNOME, and cheaper in resources — in that order.

---

## 1. Reference Project Assessment

### 1.1 Features to carry forward (from the reference repo)

| Feature | Detail |
|---|---|
| Panel ticker | Cycles through added stocks showing live price in the top bar |
| Dropdown menu | Summary/detail view per stock with market data |
| Charting | Custom-drawn charts, intraday → 5 years |
| Data providers | Yahoo Finance + Eastmoney (China markets) |
| Portfolios | Multiple portfolios; symbols per portfolio |
| Caching | Data cache with auto-reload; manual refresh button |
| Off-market prices | Optional pre/post-market display in ticker |
| Settings | Per-symbol name, display toggles, panel position, ticker interval |

### 1.2 Known problems in the reference (anti-pattern checklist)

- **EGO rejection churn:** versions 33–36 all Rejected before v37 → lifecycle/review-compliance debt.
- **4-year-old bug:** settings gear inside the dropdown menu does nothing.
- **No symbol search:** users must manually find symbols on provider websites (`1.000001`-style IDs).
- **Fixed 10 s polling:** rate-limit-prone, wasteful, no backoff/offline handling.
- **Silent failures:** stale/empty data with no error state when Yahoo auth crumb breaks.
- **Layout:** detail page poorly organized, overflows the panel menu; inconsistent buttons.
- **Maintenance signals:** stale README, docs typos, dropped AUR package, no CI/tests.

---

## 2. Gap Analysis (Technical)

1. **Lifecycle/review compliance** — leaks of timeouts/signals/requests on `disable()`.
2. **No symbol search** — biggest functional gap; provider search endpoints make it trivial.
3. **Polling strategy** — no market-hours awareness, backoff, or offline suspension.
4. **Invisible errors** — no per-symbol error badge, no "last updated" timestamp.
5. **Main-loop jank risk** — synchronous JSON parsing; needs chunked async parsing.
6. **Asset-class assumptions** — equity-centric; crypto/forex (24/7, pairs) mishandled.
7. **Provider abstraction** — hard-coded providers; needs a registry (Section 0.4).
8. **Storage** — JSON strings in GSettings; no migrations, import/export, or reorder guarantees.
9. **Legacy prefs UI** — notebook tabs instead of libadwaita.
10. **No dev infrastructure** — no CI, lint, tests, or release automation.

---

## 3. Consolidated Feature & Improvement List

### A. Reliability & Performance

| # | Item | Spec |
|---|---|---|
| A1 | Settings gear in menu | Calls `extension.openPreferences()`; primary config path |
| A2 | Lifecycle audit | Destroy actors, remove timeouts/idles, disconnect signals, cancel requests in `disable()`; 10× leak test in CI |
| A3 | Error & freshness states | Per-symbol error badge, "last updated HH:MM", `GNetworkMonitor` offline detection |
| A4 | Adaptive polling | 30–60 s market hours / ≥15 min off-hours; backoff on 429; suspend when locked/idle/offline; pause-on-battery & DND options |
| A5 | Performance budget | Per Section 0.5; shared `Soup.Session`; lazy chart draw; actors destroyed on menu close; debounced settings; Sysprof CI |
| A6 | GNOME compatibility | 46–49; CI install matrix; runtime feature detection; zero deprecated APIs |

### B. Daily Touchpoint UX (owner-requested)

| # | Item | Spec |
|---|---|---|
| B1 | **Detail view layout & panel fit** | Fixed max width = menu width; zero horizontal scroll; responsive 2-column stats grid; chart fixed aspect ratio; ellipsized names; 8-px rhythm |
| B2 | **Button & control design language** | Flat default, one suggested accent; ≥32 px hit targets; icon+label pairs; pill change-chips; soft hover; quiet low-contrast chrome |
| B3 | **Ticker rotation control & pinning** | Interval slider in prefs + panel submenu; **Pin symbol** mode (right-click row → "Pin to panel"); pause-on-hover; cycling on by default |
| B4 | **Panel display format option** | Global enum: Price / Change % / Change (abs) / Price + %; per-symbol override; compact value-only mode |
| B5 | **Add-symbol flow redesign** | "＋ Add Symbol" → search dialog with live results (name, exchange, type badge: Equity/ETF/Crypto); inline validation; recent searches; "Popular" row (S&P 500, NASDAQ, BTC); portfolio picker in-dialog |

### C. Features & Intelligence

| # | Item | Spec |
|---|---|---|
| C1 | Price alerts | ±%/absolute thresholds → native GNOME notifications; **session-bound (extension active only)**; **no sound**; quiet hours; per-symbol management |
| C2 | Portfolio totals & P&L | Quantity + buy price → position value, day gain, total gain; **local-only storage**; "hide values" privacy toggle |
| C3 | Sparklines | 32-px inline mini-charts in menu rows (Cairo, soft palette) |
| C4 | Currency conversion | Display any quote in locale currency (Frankfurter/ECB FX rates) |
| C5 | Market status | Open/closed/pre-market dot; next open/close time; 24/7 badge for crypto |
| C6 | Chart comparison mode | Overlay 2–3 symbols, normalized % |
| C7 | Dividends & earnings | Next dates in detail view where provider supports it |
| C8 | Multi-provider registry & failover | Free no-key providers (Yahoo, Eastmoney default; Stooq, CoinGecko, Binance public, Frankfurter as validated); **multi-select in settings**; per-symbol failover with UI hint |
| C9 | Offline grace | Persist last-good quotes; show greyed with timestamp |
| C10 | Import/export | Portfolio JSON export/import; CSV export; copy formatted quote to clipboard |
| C11 | GNOME integrations | Shell Search Provider; Quick Settings pause toggle; configurable menu shortcut |
| C12 | Desktop widget mode | Detached always-on-top chart window |
| C13 | Onboarding | First-run `Adw.Dialog` offering demo portfolio (S&P 500, NASDAQ, BTC); time-to-value <30 s |

---

## 4. UI/UX Specification (Design System)

1. **Information hierarchy (menu row):** name → large price → soft change chip (▲/▼ with % and absolute) → sparkline → key-stats grid.
2. **Ticker ergonomics:** click = next; right-click = pin/pause; middle-click = refresh; fade transitions; capped width.
3. **States:** skeleton rows while fetching; friendly empty state ("No symbols yet — add your first stock"); per-symbol error with retry; offline banner with cached data.
4. **Accessibility:** `accessible-name` everywhere, keyboard navigation, high-contrast + text-scaling support, polite ATK announcements on price changes.
5. **Color system:** theme-derived; colorblind-safe blue/orange option; dark-style compliant; charts in soft, low-saturation tones with smooth ease-out animation.
6. **Panel conventions:** symbolic icon (delivered), `PopupMenuSection`s, bottom "Settings" with separator.
7. **Calm design principle:** minimal chrome, generous whitespace, one accent color, short fades only — quiet and soft throughout.
8. **Icon:** calm pulse-line motif on a soft blue→mint gradient (full color) + monochrome symbolic for the panel. Assets delivered with this plan.

---

## 5. Build Order (All Phases Ship in v1.0)

| Phase | Items | Effort | Gate to proceed |
|---|---|---|---|
| **1 — Foundation** | A1, A2, A3, B1, B2 | M | 10× lifecycle leak test clean; EGO dry-run review of rules |
| **2 — Core UX** | B5 (search flow + libadwaita prefs), B3, B4 | M | Add-symbol in <3 clicks; all ticker modes persist |
| **3 — Engine** | A4, A5, A6, C8 (registry + failover), C9 | L | Perf budget met; failover + offline simulated green; 46–49 matrix green |
| **4 — Intelligence** | C1 (alerts), C2 (P&L), C4, C5, C10 | L | Alerts fire session-bound without sound; P&L accurate vs. manual calc |
| **5 — Delight** | C3, C6, C7, C11, C12, C13 | L | Full acceptance checklist (Section 6) |

---

## 6. Acceptance Checklist (Quality Gates)

### Review readiness
- [ ] 10× enable/disable: zero leaked actors, timeouts, signals, or pending requests
- [ ] ESLint zero warnings; `glib-compile-schemas` clean
- [ ] Installs and functions on GNOME 46, 47, 48, 49 (CI matrix green)
- [ ] No synchronous I/O, no subprocesses, no writes outside sanctioned dirs
- [ ] Every async path exception-contained

### Performance
- [ ] Idle CPU ≈ 0% over 10-min trace; wakeups only on scheduled poll
- [ ] RSS < 15 MB with 30-symbol portfolio
- [ ] Menu open < 50 ms; no frame drops during ticker/chart animation

### UX
- [ ] Designed empty/loading/error/offline states on every view
- [ ] Full keyboard navigation; screen-reader names verified
- [ ] Dark style + colorblind-safe palette verified; soft chart palette confirmed
- [ ] Text-scaling 200%: no clipped/overflowing content
- [ ] Panel width never displaces other indicators (tested at 1280×800)

### Functionality
- [ ] Add symbol via search dialog in <3 clicks (equity + crypto, e.g., BTC)
- [ ] Ticker: pin, interval, display-format, pause-on-hover work and persist; cycling default-on
- [ ] Provider multi-select persists; disabling Yahoo → automatic failover with UI hint
- [ ] Alerts fire only while extension active; no sound; quiet hours respected
- [ ] P&L matches manual calculation; "hide values" toggle masks amounts instantly
- [ ] Network outage simulated → cached quotes greyed with timestamp

---

## 7. Discoverability: SEO & AI-Agent Indexing Plan

### 7.1 Target Keywords

Primary: *GNOME stocks extension*, *Linux stock ticker panel*, *GNOME Shell market tracker*, *stock quotes top bar Linux*.
Crypto: *crypto ticker GNOME*, *bitcoin price panel Linux*, *cryptocurrency GNOME extension*.
Long-tail: *portfolio tracker GNOME Shell*, *stock price alerts Linux desktop*, *Yahoo Finance GNOME panel*.

### 7.2 GitHub Repository SEO

- **Repo:** `market-pulse-gnome-extension`; description: *"Market Pulse — live stock & crypto quotes, ticker, charts, alerts and portfolio tracking in your GNOME Shell panel"*
- **Topics:** `gnome-shell-extension`, `gnome`, `stocks`, `stock-ticker`, `linux`, `gjs`, `finance`, `cryptocurrency`, `bitcoin`, `crypto`, `portfolio-tracker`, `libadwaita`, `panel`, `stock-market`
- **Social preview image:** the Market Pulse icon on a calm branded banner
- **README structure (crawlable, semantic):**
  1. H1 `Market Pulse` + one-line keyword-rich summary
  2. Badges (license GPL-3.0, CI status, EGO version)
  3. `<!-- TODO(owner): add screenshots/GIF after development -->` placeholder section
  4. Features (bulleted, keyword-rich: ticker, charts, alerts, portfolio P&L, crypto, multi-provider)
  5. Compatibility table (GNOME 46–49) and provider table in plain text
  6. Installation (EGO / manual zip / distro packages)
  7. FAQ (see 7.3)
  8. Development setup, Contributing, Credits (reference project attribution), License
- **CHANGELOG.md** maintained per release — engines and agents cite versioned facts

### 7.3 AI-Agent Indexing (GEO)

- **FAQ blocks** in README using exact question phrasing agents match: *"How do I add a stock in Market Pulse?"*, *"Which GNOME versions does Market Pulse support?"*, *"Does Market Pulse support crypto?"*, *"Which data providers does Market Pulse use?"*
- **`llms.txt`** at repo root: concise summary of purpose, features, install, configuration, compatibility, and repo map for agentic crawlers
- **Consistent entity naming:** always "Market Pulse" + "GNOME Shell extension" together in every public mention so agents bind the entities
- **Structured metadata:** complete `metadata.json`; schema XML with human-readable `<summary>`/`<description>` per key
- **Plain-text tables** (compatibility, providers, features) — the format LLMs extract most reliably

### 7.4 extensions.gnome.org Listing

- Keyword-rich description mirroring README §Features; category: *Finance/Utilities*
- 3+ screenshots (owner adds post-development) + icon
- Homepage → GitHub repo; prompt, polite responses to reviews (review history matters for trust)

### 7.5 Off-Site & Launch

- **Landing page:** GitHub Pages site (`shahabahreini.github.io/market-pulse-gnome-extension`) — hero, features, install button, FAQ; linked from repo and EGO
- **Distro packaging:** AUR (`gnome-shell-extension-market-pulse`), Fedora Copr; link both in README
- **Launch posts:** r/gnome and r/linux release threads; tip emails to OMG!Ubuntu / It's FOSS / LinuxLinks (all covered stocks extensions before)
- **Cross-links:** answer relevant Reddit/StackExchange/Discourse threads where users ask for GNOME stock tickers
- **Optional:** 30-second demo GIF/clip reused across README, EGO, landing page, and posts (owner-produced post-development)

---

## 8. Naming & Branding

- **Decision:** **Market Pulse** (selected from a 10-candidate shortlist including Tickr, Stockpile, Bourse, Quoteflow).
- **Rationale:** conveys live, glanceable market health; professional; scales beyond a ticker (alerts, P&L, widgets).
- **Brand tokens:** name `Market Pulse`; uuid `market-pulse@shahabahreini.github.com`; schema `org.gnome.shell.extensions.market-pulse`; log prefix `[market-pulse]`.
- **Icon:** calm pulse-line motif, soft blue→mint gradient (full color) + monochrome symbolic. Files: `market-pulse-icon.svg`, `market-pulse-symbolic.svg`.
- **Verify before launch:** name availability on extensions.gnome.org and within GitHub search.

---

*End of plan. All 16 owner decisions are locked (Section 0.2). Build in phase order; every phase gate must pass before proceeding; all phases ship together as Market Pulse v1.0 under GPL-3.0.*
