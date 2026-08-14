/* Market Pulse — quote polling scheduler
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { MarketHours } from '../helpers/marketHours.js';

const UPOWER_BUS = 'org.freedesktop.UPower';
const UPOWER_PATH = '/org/freedesktop/UPower';

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
        this._polling = false;
        this._refreshPending = false;
        this._forceRefresh = false;
        this._destroyed = false;
        this._lastFetchedAt = new Map();
        this._onBattery = false;
        this._upowerProxy = null;
        this._upowerSignalId = null;
        this._lockedSignalId = null;

        this._networkMonitor = Gio.NetworkMonitor.get_default();
        this._networkSignalId = this._networkMonitor.connect('network-changed', (monitor, available) => {
            if (available && !this._isPaused) this.triggerRefresh();
        });

        this._watchScreenLock();
        this._watchBattery();
    }

    // --- Suspension inputs ---

    _watchScreenLock() {
        const shield = Main.screenShield;
        if (!shield) return;
        this._lockedSignalId = shield.connect('locked-changed', () => {
            if (shield.locked) {
                this.stop();
            } else if (!this._isPaused) {
                this.triggerRefresh();
            }
        });
    }

    _watchBattery() {
        // Async proxy creation — never block the main loop on D-Bus.
        Gio.DBusProxy.new(
            Gio.DBus.system,
            Gio.DBusProxyFlags.DO_NOT_AUTO_START,
            null,
            UPOWER_BUS,
            UPOWER_PATH,
            UPOWER_BUS,
            null,
            (source, result) => {
                try {
                    this._upowerProxy = Gio.DBusProxy.new_finish(result);
                    this._readBatteryState();
                    this._upowerSignalId = this._upowerProxy.connect('g-properties-changed', () => {
                        this._readBatteryState();
                    });
                } catch (e) {
                    console.warn(`[market-pulse] UPower unavailable, battery pausing disabled: ${e.message}`);
                }
            }
        );
    }

    _readBatteryState() {
        try {
            const value = this._upowerProxy?.get_cached_property('OnBattery');
            this._onBattery = value ? value.get_boolean() : false;
        } catch (e) {
            this._onBattery = false;
        }
    }

    _isSuspended() {
        if (this._isPaused) return true;
        if (Main.screenShield?.locked) return true;
        if (this._onBattery && this._settingsHelper.get('pause-on-battery')) return true;
        return false;
    }

    // --- Scheduling ---

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
        this._refreshPending = false;
        this.stop();
    }

    resume() {
        this._isPaused = false;
        this.triggerRefresh();
    }

    triggerRefresh() {
        if (this._destroyed || this._isPaused) return;

        this._forceRefresh = true;

        // A new timer would return immediately while the cancelled poll still
        // owns the scheduler. Let that poll's finally block start one precise
        // replacement instead. This is especially important after GNOME
        // reports that a previously offline network is available again.
        if (this._polling) {
            this._refreshPending = true;
            this._cancellable?.cancel();
            return;
        }

        this.scheduleNextPoll(0);
    }

    scheduleNextPoll(delaySeconds = null) {
        this.stop();
        if (this._destroyed || this._isPaused) return;

        let interval = delaySeconds;
        if (interval === null) {
            const portfolio = this._settingsHelper.getActivePortfolio();
            interval = this._secondsUntilNextDue(portfolio.symbols);
        }

        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, Math.max(1, interval), () => {
            this._timeoutId = null;
            this._pollQuotes().catch(e => {
                console.error(`[market-pulse] Unhandled poll error: ${e.message}`);
                this.scheduleNextPoll();
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    async _pollQuotes() {
        if (this._destroyed || this._polling) return;

        if (this._isSuspended()) {
            // Re-check on the off-hours cadence rather than spinning.
            this.scheduleNextPoll(this._settingsHelper.get('off-market-polling-interval') || 900);
            return;
        }

        if (!this._networkMonitor.get_network_available()) {
            this._emitCached({ offline: true });
            this.scheduleNextPoll(120);
            return;
        }

        const portfolio = this._settingsHelper.getActivePortfolio();
        if (portfolio.symbols.length === 0) {
            this.scheduleNextPoll(60);
            return;
        }

        const forceRefresh = this._forceRefresh;
        this._forceRefresh = false;
        const dueSymbols = portfolio.symbols.filter(symbolObj => forceRefresh || this._isDue(symbolObj));
        if (dueSymbols.length === 0) {
            this.scheduleNextPoll();
            return;
        }

        this._polling = true;
        this._cancellable = new Gio.Cancellable();
        const cancellable = this._cancellable;
        const enabledIds = this._settingsHelper.getEnabledProviders();

        let rateLimited = false;
        let fetchedAny = false;
        const fetchedMap = {};

        try {
            for (const symObj of dueSymbols) {
                if (cancellable.is_cancelled()) break;

                const chain = this._registry.getChainForSymbol(symObj, enabledIds);
                let quote = null;
                let lastError = null;

                // Per-symbol failover: walk the chain until one provider answers.
                for (const provider of chain) {
                    try {
                        const result = await provider.fetchQuotes([symObj.symbol], cancellable);
                        if (result && result[symObj.symbol]) {
                            quote = result[symObj.symbol];
                            quote.providerUsed = provider.id;
                            break;
                        }
                    } catch (e) {
                        lastError = e;
                        if (e.statusCode === 429 || e.statusCode === 503) {
                            rateLimited = true;
                        }
                    }
                }

                if (quote) {
                    fetchedMap[symObj.symbol] = quote;
                    this._lastFetchedAt.set(symObj.symbol, Date.now());
                    fetchedAny = true;
                } else {
                    // Keep the last good value visible, flagged with its error.
                    const cached = this._cache.get(symObj.symbol);
                    if (cached) {
                        cached.error = lastError ? lastError.message : 'No provider returned data';
                        fetchedMap[symObj.symbol] = cached;
                    }
                    // A cancelled request is a normal part of disable()/refresh,
                    // not a failure worth logging.
                    if (!cancellable.is_cancelled()) {
                        console.warn(`[market-pulse] No quote for ${symObj.symbol}${lastError ? `: ${lastError.message}` : ''}`);
                    }
                }
            }
        } finally {
            this._polling = false;
            if (this._cancellable === cancellable) this._cancellable = null;
        }

        if (this._destroyed) return;

        if (rateLimited) {
            this._backoffFactor = Math.min(this._backoffFactor * 2, 8);
            console.warn(`[market-pulse] Rate limited; backoff factor now ${this._backoffFactor}.`);
        } else if (fetchedAny) {
            this._backoffFactor = 1;
        }

        if (Object.keys(fetchedMap).length > 0) {
            this._cache.setMultiple(fetchedMap);
            this._emitCached({ offline: false });
        }

        if (this._refreshPending) {
            this._refreshPending = false;
            this.scheduleNextPoll(0);
        } else {
            this.scheduleNextPoll();
        }
    }

    _emitCached(state) {
        if (this._onQuotesUpdated) {
            this._onQuotesUpdated(this._cache.getAll(), state);
        }
    }

    /** Poll cadence is calculated per saved symbol, not per portfolio. */
    _intervalForSymbol(symbolObj) {
        const quote = this._cache.get(symbolObj.symbol);
        const status = MarketHours.getMarketStatus(symbolObj, quote?.marketState);
        const baseInterval = status.isOpen
            ? (this._settingsHelper.get('market-polling-interval') || 30)
            : (this._settingsHelper.get('off-market-polling-interval') || 900);
        return baseInterval * this._backoffFactor;
    }

    _isDue(symbolObj, now = Date.now()) {
        const lastFetchedAt = this._lastFetchedAt.get(symbolObj.symbol);
        return !lastFetchedAt || now - lastFetchedAt >= this._intervalForSymbol(symbolObj) * 1000;
    }

    _secondsUntilNextDue(symbols) {
        if (symbols.length === 0) return 60;
        const now = Date.now();
        let shortestDelayMs = Infinity;
        for (const symbolObj of symbols) {
            const lastFetchedAt = this._lastFetchedAt.get(symbolObj.symbol);
            if (!lastFetchedAt) return 0;
            const dueAt = lastFetchedAt + this._intervalForSymbol(symbolObj) * 1000;
            shortestDelayMs = Math.min(shortestDelayMs, dueAt - now);
        }
        return Math.max(1, Math.ceil(shortestDelayMs / 1000));
    }

    destroy() {
        this._destroyed = true;
        this._refreshPending = false;
        this._forceRefresh = false;
        this.stop();

        if (this._networkSignalId) {
            this._networkMonitor.disconnect(this._networkSignalId);
            this._networkSignalId = null;
        }
        if (this._lockedSignalId && Main.screenShield) {
            Main.screenShield.disconnect(this._lockedSignalId);
            this._lockedSignalId = null;
        }
        if (this._upowerSignalId && this._upowerProxy) {
            this._upowerProxy.disconnect(this._upowerSignalId);
            this._upowerSignalId = null;
        }

        this._upowerProxy = null;
        this._lastFetchedAt.clear();
        this._onQuotesUpdated = null;
    }
}
