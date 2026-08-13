/* Market Pulse — extension entry point
 * SPDX-License-Identifier: GPL-3.0-or-later
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
import { symbolicGIcon } from './helpers/icons.js';

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
            this._alertEngine = new AlertEngine(this._settings, symbolicGIcon(this.path));

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
            this._panelTicker = new PanelTicker(this._settings, this._scheduler, this.path);
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

            this._syncQuickSettings();
            this._syncSearchProvider();
            this._syncKeybinding();

            // Integration preferences take effect immediately, so the user
            // never has to disable and re-enable the extension.
            this._settings.connect('quick-settings-integration', () => this._syncQuickSettings());
            this._settings.connect('search-provider-enabled', () => this._syncSearchProvider());
            this._settings.connect('menu-shortcut-enabled', () => this._syncKeybinding());
            this._settings.connect('menu-shortcut', () => this._syncKeybinding(true));
            this._settings.connect('panel-position', () => this._syncPanelPosition());
            this._settings.connect('active-portfolio', () => {
                this._panelTicker?.onPortfolioChanged();
                // Rows only exist while the menu is open.
                if (this._panelTicker?.menu.isOpen) this._stocksMenu?.renderSymbolList();
                this._scheduler?.triggerRefresh();
            });

            // Start Polling Loop
            this._scheduler.start();

            // First-run onboarding — after the UI exists.
            if (!this._settings.get('first-run-complete')) {
                this._showOnboarding();
            }
        } catch (e) {
            console.error(`[market-pulse] Exception during enable(): ${e.message}\n${e.stack}`);
        }
    }

    // --- Optional integrations ---
    //
    // Each _sync* method brings one integration in line with its current
    // preference and is safe to call repeatedly.

    _syncQuickSettings() {
        const wanted = this._settings.get('quick-settings-integration');
        if (wanted && !this._quickSettings) {
            try {
                this._quickSettings = new QuickSettingsIndicator(this._scheduler);
            } catch (e) {
                console.warn(`[market-pulse] Quick Settings fallback: ${e.message}`);
            }
        } else if (!wanted && this._quickSettings) {
            this._quickSettings.destroy();
            this._quickSettings = null;
        }
    }

    _syncSearchProvider() {
        const wanted = this._settings.get('search-provider-enabled');
        if (wanted && !this._searchProvider) {
            this._registerSearchProvider();
        } else if (!wanted && this._searchProvider) {
            this._unregisterSearchProvider();
        }
    }

    /** `force` re-registers an already-active binding after an accel change. */
    _syncKeybinding(force = false) {
        const wanted = this._settings.get('menu-shortcut-enabled');
        if (this._keybindingAdded && (force || !wanted)) {
            Main.wm.removeKeybinding('menu-shortcut');
            this._keybindingAdded = false;
        }
        if (wanted && !this._keybindingAdded) {
            this._addKeybinding();
        }
    }

    /**
     * Moves the existing indicator between panel boxes. addToStatusArea cannot
     * be called twice for one role, so the container is re-parented directly.
     */
    _syncPanelPosition() {
        if (!this._panelTicker) return;
        const position = this._settings.get('panel-position') || 'right';
        try {
            const box = {
                left: Main.panel._leftBox,
                center: Main.panel._centerBox,
                right: Main.panel._rightBox
            }[position];
            if (!box) return;

            const container = this._panelTicker.container;
            container.get_parent()?.remove_child(container);
            box.insert_child_at_index(container, position === 'right' ? 0 : box.get_n_children());
        } catch (e) {
            console.warn(`[market-pulse] Could not move panel indicator: ${e.message}`);
        }
    }

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

    _unregisterSearchProvider() {
        if (!this._searchProvider) return;
        try {
            Main.overview.searchController.removeProvider(this._searchProvider);
        } catch (e) {
            console.warn(`[market-pulse] Could not remove search provider: ${e.message}`);
        }
        this._searchProvider.destroy();
        this._searchProvider = null;
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

    isWidgetOpen() {
        return !!this._widget;
    }

    /** Opens the detached always-on-top chart widget. */
    toggleWidget(symbolObj) {
        if (this._widget) {
            this._widget.destroy();
            this._widget = null;
            this._widgetSymbol = null;
            this._stocksMenu?.syncWidgetState();
            return;
        }
        if (!symbolObj) return;

        this._widgetSymbol = symbolObj;
        this._widget = new WidgetWindow(this._settings, this._registry);
        this._widget.setCloseHandler(() => this.toggleWidget(null));
        this._widget.show(symbolObj, this._cache.get(symbolObj.symbol));
        this._stocksMenu?.syncWidgetState();
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
            this._unregisterSearchProvider();

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
