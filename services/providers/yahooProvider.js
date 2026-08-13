/* Market Pulse — Yahoo Finance
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseQuoteProvider } from '../quoteProvider.js';
import { Quote } from '../../helpers/models.js';

const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

export class YahooProvider extends BaseQuoteProvider {
    constructor() {
        super('yahoo', 'Yahoo Finance', ['equity', 'etf', 'index', 'crypto', 'forex', 'future', 'mutualfund']);
        this._hostIndex = 0;
    }

    /** Rotates hosts so a throttled endpoint does not sink every later request. */
    async _getJsonWithFailover(path, cancellable) {
        let lastError = null;
        for (let attempt = 0; attempt < HOSTS.length; attempt++) {
            const host = HOSTS[(this._hostIndex + attempt) % HOSTS.length];
            try {
                const json = await this._httpGetJson(`${host}${path}`, {}, cancellable);
                if (json) {
                    this._hostIndex = (this._hostIndex + attempt) % HOSTS.length;
                    return json;
                }
            } catch (e) {
                lastError = e;
            }
        }
        if (lastError) throw lastError;
        return null;
    }

    async fetchQuotes(symbols, cancellable = null) {
        if (!symbols || symbols.length === 0) return {};

        const quotesMap = {};
        let rateLimitError = null;

        for (const symbol of symbols) {
            try {
                const quote = await this._fetchOneQuote(symbol, cancellable);
                if (quote) quotesMap[symbol] = quote;
            } catch (e) {
                if (e.statusCode === 429 || e.statusCode === 503) {
                    // Stop hammering — let the scheduler back off.
                    rateLimitError = e;
                    break;
                }
                console.warn(`[market-pulse] Yahoo error for ${symbol}: ${e.message}`);
            }
        }

        if (rateLimitError && Object.keys(quotesMap).length === 0) {
            throw rateLimitError;
        }
        return quotesMap;
    }

    async _fetchOneQuote(symbol, cancellable) {
        const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
        const json = await this._getJsonWithFailover(path, cancellable);

        const result = json?.chart?.result?.[0];
        if (!result || !result.meta) return null;

        const meta = result.meta;
        const price = meta.regularMarketPrice ?? null;
        if (price === null) return null;

        const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
        const change = previousClose !== null ? price - previousClose : 0;
        const changePercent = previousClose ? (change / previousClose) * 100 : 0;

        // Close series doubles as the sparkline; nulls mark gaps in trading.
        const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(v => v !== null && v !== undefined);

        return new Quote({
            symbol,
            price,
            change,
            changePercent,
            currency: meta.currency || 'USD',
            high: meta.regularMarketDayHigh ?? null,
            low: meta.regularMarketDayLow ?? null,
            open: closes.length > 0 ? closes[0] : null,
            previousClose,
            volume: meta.regularMarketVolume ?? null,
            marketState: meta.marketState || 'REGULAR',
            exchangeName: meta.fullExchangeName || meta.exchangeName || '',
            timestamp: Date.now(),
            providerUsed: this.id,
            sparkline: closes.slice(-40)
        });
    }

    async searchSymbols(query, cancellable = null) {
        if (!query || query.trim().length === 0) return [];
        const path = `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;

        const json = await this._getJsonWithFailover(path, cancellable);
        if (!json || !Array.isArray(json.quotes)) return [];

        return json.quotes
            .filter(q => q.symbol)
            .map(q => ({
                symbol: q.symbol,
                name: q.shortname || q.longname || q.symbol,
                type: this._normalizeType(q.quoteType),
                exchange: q.exchDisp || q.exchange || '',
                provider: 'yahoo'
            }));
    }

    _normalizeType(quoteType) {
        const t = (quoteType || 'equity').toLowerCase();
        if (t === 'cryptocurrency') return 'crypto';
        if (t === 'currency') return 'forex';
        return t;
    }

    async fetchChartData(symbol, range = '1d', interval = '5m', cancellable = null) {
        const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
        const json = await this._getJsonWithFailover(path, cancellable);

        const res = json?.chart?.result?.[0];
        if (!res) return [];

        const timestamps = res.timestamp || [];
        const closes = res.indicators?.quote?.[0]?.close || [];

        const points = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (closes[i] !== null && closes[i] !== undefined) {
                points.push({ time: timestamps[i] * 1000, price: closes[i] });
            }
        }
        return points;
    }
}
