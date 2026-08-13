# Changelog — Market Pulse

All notable changes to the Market Pulse GNOME Shell extension will be documented in this file.

## [1.0.0] — 2026-08-13

### Added
- **Initial Clean-Room Release** for GNOME Shell 46, 47, 48, 49, and 50+.
- Top panel ticker cycling with customizable display modes (Price + %, Price, %, Abs).
- Live symbol search modal supporting equities, ETFs, indices, and crypto symbols.
- Custom Cairo charting canvas supporting 1D, 1M, 6M, 1Y, and 5Y historical view.
- Sparkline mini-charts in dropdown menu rows.
- Multi-provider architecture with automatic failover (Yahoo Finance, Eastmoney, Stooq, CoinGecko, Binance, Frankfurter).
- Session-bound price alert engine with silent native GNOME notifications and quiet hours.
- Local portfolio profit and loss (P&L) tracking with privacy masking toggle.
- Libadwaita preferences window (`Adw.PreferencesWindow`) with 5 dedicated configuration pages.
- Memory leak-free lifecycle hygiene in `disable()` complying with EGO submission requirements.
