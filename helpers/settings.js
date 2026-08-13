/* Market Pulse — GSettings access
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import GLib from 'gi://GLib';
import { Portfolio, SymbolData, AlertRule } from './models.js';

export class SettingsHelper {
    constructor(extension) {
        this._settings = extension.getSettings();
        this._signalIds = [];
        this._saveDebounceId = null;
    }

    getSettings() {
        return this._settings;
    }

    // --- Portfolio Management ---

    getPortfolios() {
        // A debounced write may not have reached GSettings yet — prefer it so
        // rapid edits never read back a stale portfolio.
        if (this._pendingPortfolios) {
            const portfolios = {};
            for (const [id, p] of Object.entries(this._pendingPortfolios)) {
                portfolios[id] = new Portfolio(p);
            }
            return portfolios;
        }

        try {
            const raw = this._settings.get_string('portfolios');
            const data = JSON.parse(raw);
            const portfolios = {};
            for (const [id, p] of Object.entries(data)) {
                portfolios[id] = new Portfolio(p);
            }
            return portfolios;
        } catch (e) {
            console.error(`[market-pulse] Error parsing portfolios GSettings: ${e.message}`);
            return {
                'default': new Portfolio({
                    id: 'default',
                    name: 'Main Portfolio',
                    symbols: [
                        new SymbolData({ symbol: '^GSPC', name: 'S&P 500', type: 'index', provider: 'yahoo' }),
                        new SymbolData({ symbol: '^IXIC', name: 'NASDAQ Composite', type: 'index', provider: 'yahoo' }),
                        new SymbolData({ symbol: 'BTC-USD', name: 'Bitcoin USD', type: 'crypto', provider: 'yahoo' })
                    ]
                })
            };
        }
    }

    savePortfolios(portfolios) {
        this._pendingPortfolios = portfolios;

        if (this._saveDebounceId) {
            GLib.Source.remove(this._saveDebounceId);
            this._saveDebounceId = null;
        }

        this._saveDebounceId = GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
            this._saveDebounceId = null;
            this._flushPortfolios();
            return GLib.SOURCE_REMOVE;
        });
    }

    _flushPortfolios() {
        if (!this._pendingPortfolios) return;
        try {
            this._settings.set_string('portfolios', JSON.stringify(this._pendingPortfolios));
        } catch (e) {
            console.error(`[market-pulse] Error saving portfolios: ${e.message}`);
        }
        this._pendingPortfolios = null;
    }

    getActivePortfolio() {
        const activeId = this._settings.get_string('active-portfolio') || 'default';
        const portfolios = this.getPortfolios();
        return portfolios[activeId] || Object.values(portfolios)[0] || new Portfolio({});
    }

    addSymbolToActivePortfolio(symbolObj) {
        const portfolios = this.getPortfolios();
        const activeId = this._settings.get_string('active-portfolio') || 'default';
        if (!portfolios[activeId]) {
            portfolios[activeId] = new Portfolio({ id: activeId, name: 'Main Portfolio' });
        }

        const exists = portfolios[activeId].symbols.some(s => s.symbol === symbolObj.symbol);
        if (!exists) {
            portfolios[activeId].symbols.push(symbolObj);
            this.savePortfolios(portfolios);
        }
    }

    removeSymbolFromActivePortfolio(symbolStr) {
        const portfolios = this.getPortfolios();
        const activeId = this._settings.get_string('active-portfolio') || 'default';
        if (portfolios[activeId]) {
            portfolios[activeId].symbols = portfolios[activeId].symbols.filter(s => s.symbol !== symbolStr);
            delete portfolios[activeId].holdings[symbolStr];
            this.savePortfolios(portfolios);
        }
    }

    // --- Per-Symbol Ticker Display Overrides ---

    getSymbolDisplayOverrides() {
        try {
            return JSON.parse(this._settings.get_string('symbol-display-overrides') || '{}');
        } catch (e) {
            return {};
        }
    }

    /** Returns the per-symbol format if set, otherwise the global ticker mode. */
    getDisplayModeForSymbol(symbol) {
        const overrides = this.getSymbolDisplayOverrides();
        return overrides[symbol] || this.get('ticker-mode') || 'price-and-pct';
    }

    setSymbolDisplayOverride(symbol, mode) {
        const overrides = this.getSymbolDisplayOverrides();
        if (!mode) delete overrides[symbol];
        else overrides[symbol] = mode;
        this._settings.set_string('symbol-display-overrides', JSON.stringify(overrides));
    }

    // --- Recent Searches ---

    getRecentSearches() {
        return this._settings.get_strv('recent-searches');
    }

    addRecentSearch(query) {
        const trimmed = (query || '').trim();
        if (!trimmed) return;
        const recent = this.getRecentSearches().filter(q => q.toLowerCase() !== trimmed.toLowerCase());
        recent.unshift(trimmed);
        this._settings.set_strv('recent-searches', recent.slice(0, 5));
    }

    // --- Provider Settings ---

    getEnabledProviders() {
        const val = this._settings.get_strv('providers-enabled');
        return val && val.length > 0 ? val : ['yahoo', 'eastmoney'];
    }

    setEnabledProviders(providersArray) {
        this._settings.set_strv('providers-enabled', providersArray);
    }

    // --- Alert Settings ---

    getAlertRules() {
        try {
            const raw = this._settings.get_string('alert-rules');
            const data = JSON.parse(raw || '[]');
            return data.map(a => new AlertRule(a));
        } catch (e) {
            return [];
        }
    }

    saveAlertRules(rules) {
        try {
            this._settings.set_string('alert-rules', JSON.stringify(rules));
        } catch (e) {
            console.error(`[market-pulse] Error saving alert rules: ${e.message}`);
        }
    }

    // --- General Properties ---

    /**
     * Reads any key as a plain JS value.
     * Note: GLib.Variant exposes recursiveUnpack() (camelCase) in GJS —
     * there is no snake_case alias.
     */
    get(key) {
        try {
            return this._settings.get_value(key).recursiveUnpack();
        } catch (e) {
            console.error(`[market-pulse] Error reading setting '${key}': ${e.message}`);
            return null;
        }
    }

    setBoolean(key, value) {
        this._settings.set_boolean(key, !!value);
    }

    setString(key, value) {
        this._settings.set_string(key, value ?? '');
    }

    setInt(key, value) {
        this._settings.set_int(key, Math.round(Number(value) || 0));
    }

    connect(key, callback) {
        const signalId = this._settings.connect(`changed::${key}`, callback);
        this._signalIds.push(signalId);
        return signalId;
    }

    destroy() {
        if (this._saveDebounceId) {
            GLib.Source.remove(this._saveDebounceId);
            this._saveDebounceId = null;
        }
        // Never drop an in-flight edit on the floor.
        this._flushPortfolios();
        for (const id of this._signalIds) {
            this._settings.disconnect(id);
        }
        this._signalIds = [];
    }
}
