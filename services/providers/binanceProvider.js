/**
 * Market Pulse — Binance Provider Adapter (24/7 Crypto Pairs)
 * GPL-3.0 License
 */

import { BaseQuoteProvider } from '../quoteProvider.js';
import { Quote } from '../../helpers/models.js';

export class BinanceProvider extends BaseQuoteProvider {
    constructor() {
        super('binance', 'Binance (Crypto)', ['crypto']);
    }

    async fetchQuotes(symbols, cancellable = null) {
        if (!symbols || symbols.length === 0) return {};
        const quotesMap = {};

        for (const sym of symbols) {
            try {
                const pair = sym.replace('-', '').replace('USD', 'USDT').toUpperCase();
                const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;
                const json = await this._httpGetJson(url, {}, cancellable);

                if (json && json.lastPrice) {
                    const price = parseFloat(json.lastPrice);
                    const changeAbs = parseFloat(json.priceChange);
                    const changePct = parseFloat(json.priceChangePercent);

                    quotesMap[sym] = new Quote({
                        symbol: sym,
                        price: price,
                        change: changeAbs,
                        changePercent: changePct,
                        currency: 'USD',
                        high: parseFloat(json.highPrice),
                        low: parseFloat(json.lowPrice),
                        volume: parseFloat(json.volume),
                        marketState: '24/7',
                        timestamp: Date.now()
                    });
                }
            } catch (e) {
                console.warn(`[market-pulse] Binance error for ${sym}: ${e.message}`);
            }
        }
        return quotesMap;
    }
}
