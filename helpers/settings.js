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

    // --- Multiple Portfolios ---

    getActivePortfolioId() {
        return this._settings.get_string('active-portfolio') || 'default';
    }

    setActivePortfolio(id) {
        if (!this.getPortfolios()[id]) return false;
        this._settings.set_string('active-portfolio', id);
        return true;
    }

    /** Creates a portfolio and returns its generated id. */
    createPortfolio(name) {
        const portfolios = this.getPortfolios();
        const id = `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        portfolios[id] = new Portfolio({
            id,
            name: (name || '').trim() || 'New Portfolio'
        });
        this.savePortfolios(portfolios);
        return id;
    }

    renamePortfolio(id, name) {
        const portfolios = this.getPortfolios();
        if (!portfolios[id]) return false;
        portfolios[id].name = (name || '').trim() || portfolios[id].name;
        this.savePortfolios(portfolios);
        return true;
    }

    /** Refuses to delete the last portfolio — there must always be one. */
    deletePortfolio(id) {
        const portfolios = this.getPortfolios();
        if (!portfolios[id] || Object.keys(portfolios).length <= 1) return false;

        delete portfolios[id];
        this.savePortfolios(portfolios);

        if (this.getActivePortfolioId() === id) {
            this._settings.set_string('active-portfolio', Object.keys(portfolios)[0]);
        }
        return true;
    }

    getActivePortfolio() {
        const activeId = this.getActivePortfolioId();
        const portfolios = this.getPortfolios();
        return portfolios[activeId] || Object.values(portfolios)[0] || new Portfolio({});
    }

    /**
     * Runs `mutate` against the active portfolio and saves when it reports a
     * change, creating the portfolio if it has gone missing.
     */
    _mutateActivePortfolio(mutate) {
        const portfolios = this.getPortfolios();
        const activeId = this.getActivePortfolioId();
        if (!portfolios[activeId]) {
            portfolios[activeId] = new Portfolio({ id: activeId, name: 'Main Portfolio' });
        }

        if (mutate(portfolios[activeId]) === false) return false;
        this.savePortfolios(portfolios);
        return true;
    }

    addSymbolToActivePortfolio(symbolObj) {
        return this._mutateActivePortfolio(portfolio => {
            if (portfolio.symbols.some(s => s.symbol === symbolObj.symbol)) return false;
            portfolio.symbols.push(symbolObj);
        });
    }

    removeSymbolFromActivePortfolio(symbolStr) {
        return this._mutateActivePortfolio(portfolio => {
            portfolio.symbols = portfolio.symbols.filter(s => s.symbol !== symbolStr);
            delete portfolio.holdings[symbolStr];
        });
    }

    /** Short user-facing label for the top bar; empty string clears it. */
    setSymbolNickname(symbolStr, nickname) {
        return this._mutateActivePortfolio(portfolio => {
            const target = portfolio.symbols.find(s => s.symbol === symbolStr);
            if (!target) return false;
            target.nickname = (nickname || '').trim();
        });
    }

    /** Moves a symbol by `delta` places; a move off either end is a no-op. */
    moveSymbolInActivePortfolio(symbolStr, delta) {
        return this._mutateActivePortfolio(portfolio => {
            const from = portfolio.symbols.findIndex(s => s.symbol === symbolStr);
            if (from < 0) return false;
            const to = from + delta;
            if (to < 0 || to >= portfolio.symbols.length) return false;
            const [moved] = portfolio.symbols.splice(from, 1);
            portfolio.symbols.splice(to, 0, moved);
        });
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
     * True if the compiled schema defines `key`.
     *
     * GLib treats an unknown key as a programmer error and aborts the process,
     * so try/catch cannot cover it. The schema that aborts is the installed one,
     * which goes stale when a new key lands in source before `make install`.
     */
    hasKey(key) {
        if (!this._schemaKeys) {
            this._schemaKeys = new Set(this._settings.settings_schema.list_keys());
        }
        return this._schemaKeys.has(key);
    }

    /**
     * Reads any key as a plain JS value.
     * Note: GLib.Variant exposes recursiveUnpack() (camelCase) in GJS —
     * there is no snake_case alias.
     */
    get(key) {
        if (!this.hasKey(key)) {
            console.warn(`[market-pulse] Setting '${key}' missing from installed schema — run 'make install'.`);
            return null;
        }
        try {
            return this._settings.get_value(key).recursiveUnpack();
        } catch (e) {
            console.error(`[market-pulse] Error reading setting '${key}': ${e.message}`);
            return null;
        }
    }

    setBoolean(key, value) {
        if (!this._guardWrite(key)) return;
        this._settings.set_boolean(key, !!value);
    }

    setString(key, value) {
        if (!this._guardWrite(key)) return;
        this._settings.set_string(key, value ?? '');
    }

    setInt(key, value) {
        if (!this._guardWrite(key)) return;
        this._settings.set_int(key, Math.round(Number(value) || 0));
    }

    _guardWrite(key) {
        if (this.hasKey(key)) return true;
        console.warn(`[market-pulse] Dropped write to unknown setting '${key}' — run 'make install'.`);
        return false;
    }

    connect(key, callback) {
        // `changed::<key>` is a detailed signal; an undefined detail aborts too.
        if (!this.hasKey(key)) {
            console.warn(`[market-pulse] Skipping watch on unknown setting '${key}' — run 'make install'.`);
            return null;
        }
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
