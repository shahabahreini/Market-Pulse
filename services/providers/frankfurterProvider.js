/**
 * Market Pulse — Frankfurter Provider Adapter (ECB FX Rates)
 * GPL-3.0 License
 */

import { BaseQuoteProvider } from '../quoteProvider.js';

export class FrankfurterProvider extends BaseQuoteProvider {
    constructor() {
        super('frankfurter', 'Frankfurter (ECB FX)', ['forex']);
        this._ratesCache = null;
        this._lastFetch = 0;
    }

    async getExchangeRate(fromCurrency = 'USD', toCurrency = 'EUR', cancellable = null) {
        if (fromCurrency === toCurrency) return 1.0;

        const now = Date.now();
        if (this._ratesCache && (now - this._lastFetch) < 3600000) { // 1 hour cache
            const rateFrom = fromCurrency === 'EUR' ? 1.0 : this._ratesCache[fromCurrency];
            const rateTo = toCurrency === 'EUR' ? 1.0 : this._ratesCache[toCurrency];
            if (rateFrom && rateTo) return rateTo / rateFrom;
        }

        const url = 'https://api.frankfurter.app/latest';
        const json = await this._httpGetJson(url, {}, cancellable);
        if (json && json.rates) {
            this._ratesCache = json.rates;
            this._lastFetch = now;
            const rateFrom = fromCurrency === 'EUR' ? 1.0 : this._ratesCache[fromCurrency];
            const rateTo = toCurrency === 'EUR' ? 1.0 : this._ratesCache[toCurrency];
            if (rateFrom && rateTo) return rateTo / rateFrom;
        }
        return 1.0;
    }
}
