/**
 * Market Pulse — Settings Helper
 * GPL-3.0 License
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Portfolio, SymbolData, AlertRule } from './models.js';

export class SettingsHelper {
    constructor(extension) {
        this._extension = extension;
        this._settings = extension.getSettings();
        this._signalIds = [];
        this._saveDebounceId = null;
    }

    getSettings() {
        return this._settings;
    }

    // --- Portfolio Management ---

    getPortfolios() {
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
        if (this._saveDebounceId) {
            GLib.Source.remove(this._saveDebounceId);
            this._saveDebounceId = null;
        }

        this._saveDebounceId = GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
            try {
                const jsonStr = JSON.stringify(portfolios);
                this._settings.set_string('portfolios', jsonStr);
            } catch (e) {
                console.error(`[market-pulse] Error saving portfolios: ${e.message}`);
            }
            this._saveDebounceId = null;
            return GLib.SOURCE_REMOVE;
        });
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

    get(key) {
        return this._settings.get_value(key).recursive_unpack();
    }

    set(key, gvariant) {
        this._settings.set_value(key, gvariant);
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
        for (const id of this._signalIds) {
            this._settings.disconnect(id);
        }
        this._signalIds = [];
    }
}
