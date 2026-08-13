/**
 * Market Pulse — Adaptive Polling Scheduler
 * GPL-3.0 License
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { MarketHours } from '../helpers/marketHours.js';

export class PollingScheduler {
    constructor(settingsHelper, cache, providerRegistry, onQuotesUpdatedCallback) {
        this._settingsHelper = settingsHelper;
        this._cache = cache;
        this._registry = providerRegistry;
        this._onQuotesUpdated = onQuotesUpdatedCallback;

        this._timeoutId = null;
        this._backoffFactor = 1;
        this._isPaused = false;
        this._cancellable = null;

        // Monitor network connectivity
        this._networkMonitor = Gio.NetworkMonitor.get_default();
        this._networkSignalId = this._networkMonitor.connect('network-changed', (monitor, available) => {
            if (available) {
                console.log('[market-pulse] Network restored, triggering immediate refresh.');
                this.triggerRefresh();
            }
        });
    }

    start() {
        this.scheduleNextPoll(0);
    }

    stop() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
    }

    pause() {
        this._isPaused = true;
        this.stop();
    }

    resume() {
        this._isPaused = false;
        this.triggerRefresh();
    }

    triggerRefresh() {
        this.stop();
        this.scheduleNextPoll(0);
    }

    scheduleNextPoll(delaySeconds = null) {
        this.stop();
        if (this._isPaused) return;

        let interval = delaySeconds;
        if (interval === null) {
            const portfolio = this._settingsHelper.getActivePortfolio();
            const hasOpenSymbol = portfolio.symbols.some(s => MarketHours.getMarketStatus(s.symbol).isOpen);
            
            const marketInterval = this._settingsHelper.get('market-polling-interval') || 30;
            const offMarketInterval = this._settingsHelper.get('off-market-polling-interval') || 900;
            
            interval = (hasOpenSymbol ? marketInterval : offMarketInterval) * this._backoffFactor;
        }

        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, Math.max(1, interval), () => {
            this._pollQuotes();
            return GLib.SOURCE_REMOVE;
        });
    }

    async _pollQuotes() {
        if (!this._networkMonitor.get_network_available()) {
            console.log('[market-pulse] Offline mode: skipping network fetch.');
            this.scheduleNextPoll(120);
            return;
        }

        const portfolio = this._settingsHelper.getActivePortfolio();
        const symbols = portfolio.symbols.map(s => s.symbol);
        if (symbols.length === 0) {
            this.scheduleNextPoll(60);
            return;
        }

        this._cancellable = new Gio.Cancellable();
        const enabledProviderIds = this._settingsHelper.getEnabledProviders();
        const providers = this._registry.getEnabledProviders(enabledProviderIds);

        let fetchedAny = false;
        const fetchedMap = {};

        for (const provider of providers) {
            try {
                const quotes = await provider.fetchQuotes(symbols, this._cancellable);
                if (quotes && Object.keys(quotes).length > 0) {
                    Object.assign(fetchedMap, quotes);
                    fetchedAny = true;
                }
            } catch (e) {
                if (e.statusCode === 429) {
                    console.warn(`[market-pulse] Rate limit 429 hit on ${provider.name}, applying backoff.`);
                    this._backoffFactor = Math.min(this._backoffFactor * 2, 8);
                } else {
                    console.error(`[market-pulse] Error fetching quotes from ${provider.name}: ${e.message}`);
                }
            }
        }

        if (fetchedAny) {
            this._backoffFactor = 1;
            this._cache.setMultiple(fetchedMap);
            if (this._onQuotesUpdated) {
                this._onQuotesUpdated(this._cache.getAll());
            }
        }

        this.scheduleNextPoll();
    }

    destroy() {
        this.stop();
        if (this._networkSignalId) {
            this._networkMonitor.disconnect(this._networkSignalId);
            this._networkSignalId = null;
        }
    }
}
