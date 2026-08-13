/**
 * Market Pulse — GNOME Shell Panel Extension Entry Point
 * GPL-3.0 License
 */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { SettingsHelper } from './helpers/settings.js';
import { QuoteCache } from './services/quoteCache.js';
import { ProviderRegistry } from './services/quoteProvider.js';
import { YahooProvider } from './services/providers/yahooProvider.js';
import { EastmoneyProvider } from './services/providers/eastmoneyProvider.js';
import { StooqProvider } from './services/providers/stooqProvider.js';
import { CoinGeckoProvider } from './services/providers/coingeckoProvider.js';
import { BinanceProvider } from './services/providers/binanceProvider.js';
import { FrankfurterProvider } from './services/providers/frankfurterProvider.js';
import { PollingScheduler } from './services/pollingScheduler.js';
import { AlertEngine } from './services/alertEngine.js';
import { PanelTicker } from './components/panelTicker.js';
import { StocksMenu } from './components/stocksMenu.js';

export default class MarketPulseExtension extends Extension {
    enable() {
        try {
            this._settings = new SettingsHelper(this);
            this._cache = new QuoteCache();

            // Initialize Multi-Provider Registry
            this._registry = new ProviderRegistry();
            this._registry.register(new YahooProvider());
            this._registry.register(new EastmoneyProvider());
            this._registry.register(new StooqProvider());
            this._registry.register(new CoinGeckoProvider());
            this._registry.register(new BinanceProvider());
            this._registry.register(new FrankfurterProvider());

            // Initialize Alert Engine
            this._alertEngine = new AlertEngine(this._settings);

            // Initialize Adaptive Polling Scheduler
            this._scheduler = new PollingScheduler(
                this._settings,
                this._cache,
                this._registry,
                (quotesMap) => {
                    if (this._panelTicker) this._panelTicker.updateQuotes(quotesMap);
                    if (this._stocksMenu) this._stocksMenu.updateQuotes(quotesMap);
                    if (this._alertEngine) this._alertEngine.checkQuotes(quotesMap);
                }
            );

            // Create Top Panel Ticker Indicator
            this._panelTicker = new PanelTicker(this._settings, this._scheduler);
            const position = this._settings.get('panel-position') || 'right';
            Main.panel.addToStatusArea(this.uuid, this._panelTicker, 0, position);

            // Build Dropdown Popup Menu
            this._stocksMenu = new StocksMenu(
                this._panelTicker,
                this,
                this._settings,
                this._scheduler,
                this._registry
            );

            // Start Polling Loop
            this._scheduler.start();
        } catch (e) {
            console.error(`[market-pulse] Exception during enable(): ${e.message}\n${e.stack}`);
        }
    }

    disable() {
        try {
            // 1. Destroy session alert engine
            if (this._alertEngine) {
                this._alertEngine.destroy();
                this._alertEngine = null;
            }

            // 2. Stop and destroy polling scheduler (cancels timeouts & network listeners)
            if (this._scheduler) {
                this._scheduler.destroy();
                this._scheduler = null;
            }

            // 3. Destroy popup menu
            if (this._stocksMenu) {
                this._stocksMenu.destroy();
                this._stocksMenu = null;
            }

            // 4. Destroy top bar panel button and all Clutter/St actors
            if (this._panelTicker) {
                this._panelTicker.destroy();
                this._panelTicker = null;
            }

            // 5. Destroy provider registry (abort in-flight Soup HTTP requests)
            if (this._registry) {
                this._registry.destroy();
                this._registry = null;
            }

            // 6. Save and destroy quote cache
            if (this._cache) {
                this._cache.destroy();
                this._cache = null;
            }

            // 7. Disconnect all GSettings signal handlers
            if (this._settings) {
                this._settings.destroy();
                this._settings = null;
            }
        } catch (e) {
            console.error(`[market-pulse] Exception during disable(): ${e.message}\n${e.stack}`);
        }
    }
}
