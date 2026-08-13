/**
 * Market Pulse — GNOME Shell Panel Extension Entry Point
 * GPL-3.0 License
 */

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { SettingsHelper } from './helpers/settings.js';
import { QuoteCache } from './services/quoteCache.js';
import { ProviderRegistry } from './services/quoteProvider.js';
import { YahooProvider } from './services/providers/yahooProvider.js';
import { EastmoneyProvider } from './services/providers/eastmoneyProvider.js';
import { CoinGeckoProvider } from './services/providers/coingeckoProvider.js';
import { BinanceProvider } from './services/providers/binanceProvider.js';
import { FxService } from './services/fxService.js';
import { PollingScheduler } from './services/pollingScheduler.js';
import { AlertEngine } from './services/alertEngine.js';
import { PanelTicker } from './components/panelTicker.js';
import { StocksMenu } from './components/stocksMenu.js';
import { QuickSettingsIndicator } from './components/quickSettingsToggle.js';
import { WidgetWindow } from './components/widgetWindow.js';
import { OnboardingDialog } from './components/onboardingDialog.js';
import { MarketPulseSearchProvider } from './services/searchProvider.js';
import { Formatter } from './helpers/formatter.js';

export default class MarketPulseExtension extends Extension {
    enable() {
        try {
            this._settings = new SettingsHelper(this);
            this._cache = new QuoteCache();

            // Initialize Multi-Provider Registry
            this._registry = new ProviderRegistry();
            this._registry.register(new YahooProvider());
            this._registry.register(new EastmoneyProvider());
            this._registry.register(new CoinGeckoProvider());
            this._registry.register(new BinanceProvider());

            // Currency conversion (ECB rates) — a service, not a quote provider
            this._fx = new FxService();
            Formatter.setFxService(this._fx, () => this._settings.get('display-currency') || 'USD');
            this._fx.prefetch();

            // Initialize Alert Engine
            this._alertEngine = new AlertEngine(this._settings);

            // Initialize Adaptive Polling Scheduler
            this._scheduler = new PollingScheduler(
                this._settings,
                this._cache,
                this._registry,
                (quotesMap, state) => {
                    if (this._panelTicker) this._panelTicker.updateQuotes(quotesMap);
                    if (this._stocksMenu) this._stocksMenu.updateQuotes(quotesMap, state);
                    if (this._alertEngine) this._alertEngine.checkQuotes(quotesMap);
                    if (this._widget && this._widgetSymbol) {
                        this._widget.updateQuote(quotesMap[this._widgetSymbol.symbol]);
                    }
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

            // GNOME Quick Settings Integration
            if (this._settings.get('quick-settings-integration')) {
                try {
                    this._quickSettings = new QuickSettingsIndicator(this._scheduler);
                } catch (e) {
                    console.warn(`[market-pulse] Quick Settings fallback: ${e.message}`);
                }
            }

            // Shell overview search provider (plan §C11)
            if (this._settings.get('search-provider-enabled')) {
                this._registerSearchProvider();
            }

            // Configurable keyboard shortcut for the panel menu (plan §C11)
            if (this._settings.get('menu-shortcut-enabled')) {
                this._addKeybinding();
            }

            // Start Polling Loop
            this._scheduler.start();

            // First-run onboarding (plan §C13) — after the UI exists.
            if (!this._settings.get('first-run-complete')) {
                this._showOnboarding();
            }
        } catch (e) {
            console.error(`[market-pulse] Exception during enable(): ${e.message}\n${e.stack}`);
        }
    }

    // --- Optional integrations ---

    _registerSearchProvider() {
        try {
            this._searchProvider = new MarketPulseSearchProvider(this, this._settings, this._cache);
            this._searchProvider.setActivateHandler(() => {
                this._panelTicker?.menu.open();
            });
            Main.overview.searchController.addProvider(this._searchProvider);
        } catch (e) {
            console.warn(`[market-pulse] Search provider unavailable: ${e.message}`);
            this._searchProvider = null;
        }
    }

    _addKeybinding() {
        try {
            Main.wm.addKeybinding(
                'menu-shortcut',
                this._settings.getSettings(),
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                () => this._panelTicker?.menu.toggle()
            );
            this._keybindingAdded = true;
        } catch (e) {
            console.warn(`[market-pulse] Could not register menu shortcut: ${e.message}`);
        }
    }

    /** Opens the detached always-on-top chart widget (plan §C12). */
    toggleWidget(symbolObj) {
        if (this._widget) {
            this._widget.destroy();
            this._widget = null;
            this._widgetSymbol = null;
            return;
        }
        if (!symbolObj) return;

        this._widgetSymbol = symbolObj;
        this._widget = new WidgetWindow(this._settings, this._registry);
        this._widget.setCloseHandler(() => this.toggleWidget(null));
        this._widget.show(symbolObj, this._cache.get(symbolObj.symbol));
    }

    _showOnboarding() {
        try {
            this._onboarding = new OnboardingDialog(this._settings, () => {
                this._onboarding = null;
                this._scheduler?.triggerRefresh();
            });
            this._onboarding.open();
        } catch (e) {
            console.error(`[market-pulse] Onboarding failed to open: ${e.message}`);
            // Never trap the user in a broken first run.
            this._settings.setBoolean('first-run-complete', true);
        }
    }

    disable() {
        try {
            // 0. Close transient UI first
            if (this._onboarding) {
                this._onboarding.destroy();
                this._onboarding = null;
            }
            if (this._widget) {
                this._widget.destroy();
                this._widget = null;
                this._widgetSymbol = null;
            }

            // 0b. Remove Shell integrations
            if (this._keybindingAdded) {
                Main.wm.removeKeybinding('menu-shortcut');
                this._keybindingAdded = false;
            }
            if (this._searchProvider) {
                Main.overview.searchController.removeProvider(this._searchProvider);
                this._searchProvider.destroy();
                this._searchProvider = null;
            }

            // 1. Destroy Quick Settings Indicator
            if (this._quickSettings) {
                this._quickSettings.destroy();
                this._quickSettings = null;
            }

            // 2. Destroy session alert engine
            if (this._alertEngine) {
                this._alertEngine.destroy();
                this._alertEngine = null;
            }

            // 3. Stop and destroy polling scheduler
            if (this._scheduler) {
                this._scheduler.destroy();
                this._scheduler = null;
            }

            // 4. Destroy popup menu
            if (this._stocksMenu) {
                this._stocksMenu.destroy();
                this._stocksMenu = null;
            }

            // 5. Destroy top bar panel button and clutter actors
            if (this._panelTicker) {
                this._panelTicker.destroy();
                this._panelTicker = null;
            }

            // 6. Tear down currency conversion
            Formatter.setFxService(null, null);
            if (this._fx) {
                this._fx.destroy();
                this._fx = null;
            }

            // 7. Destroy provider registry (also aborts the shared Soup session)
            if (this._registry) {
                this._registry.destroy();
                this._registry = null;
            }

            // 8. Save and destroy quote cache
            if (this._cache) {
                this._cache.destroy();
                this._cache = null;
            }

            // 9. Disconnect all GSettings signal handlers
            if (this._settings) {
                this._settings.destroy();
                this._settings = null;
            }
        } catch (e) {
            console.error(`[market-pulse] Exception during disable(): ${e.message}\n${e.stack}`);
        }
    }
}
