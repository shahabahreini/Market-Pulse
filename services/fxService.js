/* Market Pulse — currency conversion rates
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import { getSharedSession, readStatus } from './quoteProvider.js';

const RATES_URL = 'https://api.frankfurter.app/latest?base=EUR';
const CACHE_TTL_MS = 60 * 60 * 1000;

export class FxService {
    constructor() {
        this._rates = null;      // { USD: 1.15, GBP: 0.85, … } relative to EUR
        this._lastFetch = 0;
        this._inFlight = null;
    }

    async getExchangeRate(fromCurrency = 'USD', toCurrency = 'EUR', cancellable = null) {
        if (!fromCurrency || !toCurrency) return null;
        if (fromCurrency === toCurrency) return 1.0;

        const rates = await this._getRates(cancellable);
        if (!rates) return null;

        const from = fromCurrency === 'EUR' ? 1.0 : rates[fromCurrency];
        const to = toCurrency === 'EUR' ? 1.0 : rates[toCurrency];
        if (!from || !to) return null;

        return to / from;
    }

    /** Synchronous lookup for render paths that must not await. */
    getCachedRate(fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return 1.0;
        if (!this._rates) return null;
        const from = fromCurrency === 'EUR' ? 1.0 : this._rates[fromCurrency];
        const to = toCurrency === 'EUR' ? 1.0 : this._rates[toCurrency];
        if (!from || !to) return null;
        return to / from;
    }

    async _getRates(cancellable) {
        if (this._rates && Date.now() - this._lastFetch < CACHE_TTL_MS) {
            return this._rates;
        }
        // Collapse concurrent callers onto a single request.
        if (this._inFlight) return this._inFlight;

        this._inFlight = this._fetchRates(cancellable).finally(() => {
            this._inFlight = null;
        });
        return this._inFlight;
    }

    async _fetchRates(cancellable) {
        try {
            const msg = Soup.Message.new('GET', RATES_URL);
            const bytes = await getSharedSession().send_and_read_async(msg, GLib.PRIORITY_LOW, cancellable);
            if (!bytes || readStatus(msg) !== 200) return this._rates;

            const json = JSON.parse(new TextDecoder().decode(bytes.get_data()));
            if (json && json.rates) {
                this._rates = json.rates;
                this._lastFetch = Date.now();
            }
        } catch (e) {
            console.warn(`[market-pulse] FX rate fetch failed: ${e.message}`);
        }
        return this._rates;
    }

    /** Warms the cache so the first render already has rates available. */
    prefetch(cancellable = null) {
        this._getRates(cancellable).catch(() => {});
    }

    destroy() {
        this._rates = null;
        this._inFlight = null;
    }
}
