/**
 * Market Pulse — Stooq Provider Adapter (CSV & Global Equities)
 * GPL-3.0 License
 */

import { BaseQuoteProvider } from '../quoteProvider.js';
import { Quote } from '../../helpers/models.js';

export class StooqProvider extends BaseQuoteProvider {
    constructor() {
        super('stooq', 'Stooq (CSV)', ['equity', 'index', 'forex']);
    }

    async fetchQuotes(symbols, cancellable = null) {
        if (!symbols || symbols.length === 0) return {};
        const quotesMap = {};

        for (const sym of symbols) {
            try {
                const formattedSym = sym.toLowerCase().replace('^', '');
                const url = `https://stooq.com/q/l/?s=${formattedSym}&f=sd2t2ohlcv&h&e=csv`;
                const text = await this._httpGetText(url, {}, cancellable);
                if (!text) continue;

                const lines = text.trim().split('\n');
                if (lines.length >= 2) {
                    const parts = lines[1].split(',');
                    if (parts.length >= 7 && parts[1] !== 'N/D') {
                        const price = parseFloat(parts[6]);
                        const open = parseFloat(parts[3]);
                        const change = price - open;
                        const changePct = open > 0 ? (change / open) * 100 : 0;

                        quotesMap[sym] = new Quote({
                            symbol: sym,
                            price: price,
                            change: change,
                            changePercent: changePct,
                            currency: 'USD',
                            open: open,
                            high: parseFloat(parts[4]),
                            low: parseFloat(parts[5]),
                            timestamp: Date.now()
                        });
                    }
                }
            } catch (e) {
                console.warn(`[market-pulse] Stooq error for ${sym}: ${e.message}`);
            }
        }
        return quotesMap;
    }
}
