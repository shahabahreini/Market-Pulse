/**
 * Market Pulse — Yahoo Finance Provider Adapter
 * GPL-3.0 License
 */

import { BaseQuoteProvider } from '../quoteProvider.js';
import { Quote } from '../../helpers/models.js';

export class YahooProvider extends BaseQuoteProvider {
    constructor() {
        super('yahoo', 'Yahoo Finance', ['equity', 'etf', 'index', 'crypto', 'forex']);
    }

    async fetchQuotes(symbols, cancellable = null) {
        if (!symbols || symbols.length === 0) return {};
        const symList = symbols.join(',');
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symList)}`;

        const headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        };

        const json = await this._httpGetJson(url, headers, cancellable);
        if (!json || !json.quoteResponse || !json.quoteResponse.result) {
            return {};
        }

        const quotesMap = {};
        for (const item of json.quoteResponse.result) {
            const marketState = item.marketState || 'REGULAR';
            let price = item.regularMarketPrice ?? 0;
            let change = item.regularMarketChange ?? 0;
            let changePct = item.regularMarketChangePercent ?? 0;

            if (marketState === 'PRE' && item.preMarketPrice) {
                price = item.preMarketPrice;
                change = item.preMarketChange ?? change;
                changePct = item.preMarketChangePercent ?? changePct;
            } else if (marketState === 'POST' && item.postMarketPrice) {
                price = item.postMarketPrice;
                change = item.postMarketChange ?? change;
                changePct = item.postMarketChangePercent ?? changePct;
            }

            quotesMap[item.symbol] = new Quote({
                symbol: item.symbol,
                price: price,
                change: change,
                changePercent: changePct,
                currency: item.currency || 'USD',
                high: item.regularMarketDayHigh ?? null,
                low: item.regularMarketDayLow ?? null,
                open: item.regularMarketOpen ?? null,
                previousClose: item.regularMarketPreviousClose ?? null,
                volume: item.regularMarketVolume ?? null,
                marketCap: item.marketCap ?? null,
                peRatio: item.trailingPE ?? null,
                dividendYield: item.trailingAnnualDividendYield ? item.trailingAnnualDividendYield * 100 : null,
                earningsDate: item.earningsTimestamp ? new Date(item.earningsTimestamp * 1000).toISOString() : null,
                marketState: marketState,
                timestamp: Date.now(),
                sparkline: item.sparkline || []
            });
        }
        return quotesMap;
    }

    async searchSymbols(query, cancellable = null) {
        if (!query || query.trim().length === 0) return [];
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
        const headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        };

        const json = await this._httpGetJson(url, headers, cancellable);
        if (!json || !json.quotes) return [];

        return json.quotes.map(q => ({
            symbol: q.symbol,
            name: q.shortname || q.longname || q.symbol,
            type: (q.quoteType || 'equity').toLowerCase(),
            exchange: q.exchange || q.exchDisp || '',
            provider: 'yahoo'
        }));
    }

    async fetchChartData(symbol, range = '1d', interval = '5m', cancellable = null) {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
        const headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        };

        const json = await this._httpGetJson(url, headers, cancellable);

        if (!json || !json.chart || !json.chart.result || json.chart.result.length === 0) {
            return [];
        }

        const res = json.chart.result[0];
        const timestamps = res.timestamp || [];
        const quotes = res.indicators?.quote?.[0]?.close || [];

        const points = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (quotes[i] !== null && quotes[i] !== undefined) {
                points.push({
                    time: timestamps[i] * 1000,
                    price: quotes[i]
                });
            }
        }
        return points;
    }
}
