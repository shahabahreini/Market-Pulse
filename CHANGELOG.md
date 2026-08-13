# Changelog — Market Pulse

All notable changes to the Market Pulse GNOME Shell extension will be documented in this file.

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

### Notes
- **Stooq was evaluated and dropped.** Its documented CSV endpoints answered HTTP 404 on every tested URL and host, so per the project plan's provider-validation rule it does not ship.
- **Yahoo quotes use `v8/finance/chart`, not `v7/finance/quote`.** The v7 endpoint is gated behind a cookie/crumb handshake and answers HTTP 429 without one; the chart endpoint is keyless and also supplies the sparkline series.
- Session-bound price alert engine with silent native GNOME notifications and quiet hours.
- Local portfolio profit and loss (P&L) tracking with privacy masking toggle.
- Libadwaita preferences window (`Adw.PreferencesWindow`) with 5 dedicated configuration pages.
- Memory leak-free lifecycle hygiene in `disable()` complying with EGO submission requirements.
