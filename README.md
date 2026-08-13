# Market Pulse — GNOME Shell Extension

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![GNOME Shell](https://img.shields.io/badge/GNOME-46%20%7C%2047%20%7C%2048%20%7C%2049%20%7C%2050-green.svg)](https://extensions.gnome.org)

**Market Pulse** is a clean-room GNOME Shell panel extension delivering live stock and cryptocurrency quotes, dynamic top-bar ticker rotation, interactive Cairo charts, session-bound price alerts, and local portfolio profit & loss (P&L) tracking for GNOME 46–50+.

<!-- TODO(owner): add screenshots/GIF after development -->

---

## Key Features

- **Top Bar Panel Ticker**: Glanceable live quote rotation in the GNOME panel with pause-on-hover, pin-to-panel right-click option, middle-click manual refresh, and customizable display formats (Price, Change %, Absolute Change, Price + %).
- **Live Multi-Provider Symbol Search**: Search equities, ETFs, global indices, and cryptocurrencies (e.g. `AAPL`, `MSFT`, `BTC-USD`, `ETH-USD`, `^GSPC`) directly within GNOME Shell in <3 clicks.
- **Interactive Cairo Charting**: Intraday, 1-month, 6-month, 1-year, and 5-year trend line canvas with low-saturation color palettes and smooth ease-out transitions.
- **Multi-Provider Data Resilience**: Per-symbol automatic failover across free, keyless providers (**Yahoo Finance**, **Eastmoney**, **CoinGecko**, **Binance**), with **Frankfurter ECB rates** for currency conversion. When a provider fails, the row shows which one answered instead — never a silent stale price.
- **Session-Bound Price Alerts**: Native GNOME desktop notifications for target prices and surge/decline thresholds. Silent notifications without audio disruptors and configurable quiet hours.
- **Local Portfolio & P&L Tracking**: Calculate total portfolio value, daily change, and overall gains locally. Stored exclusively on device with an instant "hide values" privacy toggle for screen sharing.
- **Desktop Integration**: Overview search results for tracked symbols, a Quick Settings pause toggle, an optional `Super+M` menu shortcut, and a detachable always-on-top chart widget.
- **Libadwaita Preferences Window**: HIG-compliant `Adw.PreferencesWindow` with General, Portfolios, Providers multi-select, Alerts, and About settings pages.

---

## Desktop & Shell Compatibility

| Component          | Specification                    |
| ------------------ | -------------------------------- |
| **GNOME Shell**    | 46, 47, 48, 49, 50+              |
| **GJS Engine**     | ES2022+ / GJS 1.80+              |
| **UI Framework**   | Libadwaita / St / Clutter        |
| **Resource Usage** | Idle CPU ~0%, Memory < 15 MB RSS |

---

## Data Providers

All providers are free and require no API key.

| Provider           | Asset Classes                       | Coverage    | Default  |
| ------------------ | ----------------------------------- | ----------- | -------- |
| **Yahoo Finance**  | Equities, ETFs, Indices, Crypto, FX | Global      | Enabled  |
| **Eastmoney**      | A-Shares, SSE, SZSE, Hong Kong      | China       | Enabled  |
| **CoinGecko Free** | Cryptocurrencies                    | Global      | Optional |
| **Binance Public** | Crypto pairs                        | Global 24/7 | Optional |

Currency conversion is handled separately by **Frankfurter** (European Central Bank reference rates). It is not a quote source, so it does not appear in the provider multi-select — pick a display currency on the Providers page instead.

---

## Installation

### Manual Build & Installation

```bash
git clone https://github.com/shahabahreini/market-pulse-gnome-extension.git
cd market-pulse-gnome-extension
make install
```

After installation, restart GNOME Shell (`Alt+F2` → `r` on X11, or log out on Wayland) and enable the extension:

```bash
gnome-extensions enable market-pulse@shahabahreini.github.com
```

---

## Frequently Asked Questions (FAQ)

### How do I add a stock or crypto symbol in Market Pulse?

Click the Market Pulse top bar indicator to open the dropdown menu, then click the `+` button in the header. Type any symbol (such as `AAPL` for Apple or `BTC-USD` for Bitcoin) into the search box and select it from the live results.

### Which GNOME versions does Market Pulse support?

Market Pulse natively supports GNOME Shell versions 46, 47, 48, 49, and 50+.

### Does Market Pulse support cryptocurrency tracking?

Yes. Market Pulse provides real-time 24/7 quotes and charts for major cryptocurrencies including Bitcoin (`BTC-USD`), Ethereum (`ETH-USD`), Solana (`SOL-USD`), and Binance pairs via Yahoo Finance, CoinGecko, and Binance adapters.

### Which data providers does Market Pulse use?

Market Pulse ships with built-in adapters for Yahoo Finance, Eastmoney (China markets), Stooq, CoinGecko, Binance, and Frankfurter ECB FX rates. You can multi-select and prioritize providers in the preferences menu.

---

## Credits & Attribution

Market Pulse is built as a clean-room GNOME Shell extension inspired by the feature set of `cinatic/stocks-extension`. All code has been written from scratch under the GPL-3.0 license.

---

## License

Copyright © 2026 Shahab Bahreini Jangjoo. Released under the [GNU General Public License v3.0](LICENSE).
