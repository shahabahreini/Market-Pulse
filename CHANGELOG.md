# Changelog — Market Pulse

All notable changes to the Market Pulse GNOME Shell extension will be documented in this file.

## [v1.1.0] - 2026-08-15

### Added

- Implemented Pango markup to colorize price changes in the ticker based on performance and colorblind preferences.
- Connected settings signals to automatically refresh the display and restart timers upon configuration changes.

### Fixed

- Cleaned up settings listeners on component destruction to prevent memory leaks.

## [1.0.1] — 2026-08-13

### Fixed

- Explicitly disconnect extension-owned GSettings signals during teardown and clean up partial initialization failures.
- Reduced recoverable Shell-process logging and documented button-only, write-only local clipboard access with no third-party sharing or clipboard shortcuts for GNOME extension review.

## [v1.0.1] - 2026-08-13

### Added

- Implemented the initial Market Pulse GNOME Shell extension to support live stock and cryptocurrency tracking.
- Created a multi-provider architecture supporting Yahoo Finance, Binance, and CoinGecko.
- Integrated Frankfurter ECB rates to enable automatic currency conversion across all views.
- Added a detached, always-on-top desktop chart widget for persistent monitoring.
- Added a GNOME Shell overview search provider to allow quick access to tracked symbols.
- Implemented light and dark theme switching with system-aware auto-detection.
- Redesigned the user interface with organic tones, rounded geometry, gradients, and smooth animations.
- Added a portfolio switcher and per-symbol management actions including pinning, renaming, reordering, and removing.
- Added onboarding presets to simplify initial setup and symbol discovery.
- Added support for symbol nicknames to improve top bar readability.
- Added a quick settings toggle to pause and resume live polling.
- Added portfolio data export in JSON and CSV formats, and cost basis editing in preferences.
- Added quote copying functionality in the detail view and a freshness footer.
- Added `make qc` and `make shexli` Makefile targets to automate compliance checks, metadata validation, process boundary guards, and static analysis.
- Added a GitHub Actions workflow to automate extension packaging, linting, and releases upon pushing version tags.
- Enhanced the Makefile with `status`, `reinstall`, `pack`, and `release` targets to automate development workflows.

### Changed

- Optimized the polling scheduler to use per-symbol, market-aware intervals.
- Updated the uninstall logic in the Makefile to interact with the `gnome-extensions` CLI for improved stability.
- Standardized file headers with concise SPDX-compliant comments and updated the ESLint configuration.

### Fixed

- Implemented explicit signal tracking and teardown in the extension lifecycle to prevent resource leaks.
- Updated user-agent headers to prevent API blocking by providers.
- Implemented debouncing for settings persistence to reduce I/O overhead.
- Added visibility checks to drawing components to prevent unnecessary repaints.
- Silenced non-critical console warnings and removed error logging in clipboard helpers to reduce shell log noise.

## [1.0.0] — 2026-08-13

### Added

- **Initial Clean-Room Release** for GNOME Shell 46, 47, 48, 49, and 50+.
- Top panel ticker cycling with customizable display modes (Price + %, Price, %, Abs).
- Live symbol search modal supporting equities, ETFs, indices, and crypto symbols.
- Custom Cairo charting canvas supporting 1D, 1M, 6M, 1Y, and 5Y historical view.
- Sparkline mini-charts in dropdown menu rows.
- Multi-provider architecture with per-symbol automatic failover (Yahoo Finance, Eastmoney, CoinGecko, Binance) plus Frankfurter ECB rates for currency conversion.
- Chart comparison mode overlaying up to three symbols as normalized percentage series.
- GNOME integrations: overview search provider, Quick Settings pause toggle, optional `Super+M` menu shortcut, and a detachable always-on-top chart widget.
- First-run onboarding dialog offering a demo portfolio.
- Portfolio JSON import alongside JSON/CSV export.
- Per-symbol error badges, cached-quote timestamps, and an offline banner.

- Icon set: a brush-drawn ring with a pulse trace, in full-colour and panel-symbolic variants.

### Notes

- **Stooq was evaluated and dropped.** Its documented CSV endpoints answered HTTP 404 on every tested URL and host, so per the project plan's provider-validation rule it does not ship.
- **Yahoo quotes use `v8/finance/chart`, not `v7/finance/quote`.** The v7 endpoint is gated behind a cookie/crumb handshake and answers HTTP 429 without one; the chart endpoint is keyless and also supplies the sparkline series.
- Session-bound price alert engine with silent native GNOME notifications and quiet hours.
- Local portfolio profit and loss (P&L) tracking with privacy masking toggle.
- Libadwaita preferences window (`Adw.PreferencesWindow`) with 5 dedicated configuration pages.
- Memory leak-free lifecycle hygiene in `disable()` complying with EGO submission requirements.
