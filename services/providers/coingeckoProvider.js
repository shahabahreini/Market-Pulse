/**
 * Market Pulse — CoinGecko Provider Adapter (Cryptocurrency)
 * GPL-3.0 License
 */

import { BaseQuoteProvider } from '../quoteProvider.js';
import { Quote } from '../../helpers/models.js';

export class CoinGeckoProvider extends BaseQuoteProvider {
    constructor() {
        super('coingecko', 'CoinGecko (Crypto)', ['crypto']);
        this._coinMap = {
            'BTC-USD': 'bitcoin',
            'ETH-USD': 'ethereum',
            'SOL-USD': 'solana',
            'ADA-USD': 'cardano',
            'XRP-USD': 'ripple',
            'DOGE-USD': 'dogecoin'
        };
    }

    async fetchQuotes(symbols, cancellable = null) {
        if (!symbols || symbols.length === 0) return {};
        const ids = [];
        const symToIdMap = {};

        for (const s of symbols) {
            const coinId = this._coinMap[s] || s.toLowerCase().replace('-usd', '');
            ids.push(coinId);
            symToIdMap[coinId] = s;
        }

        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
        const json = await this._httpGetJson(url, {}, cancellable);
        if (!json) return {};

        const quotesMap = {};
        for (const [coinId, data] of Object.entries(json)) {
            const origSymbol = symToIdMap[coinId] || `${coinId.toUpperCase()}-USD`;
            const price = data.usd || 0;
            const changePct = data.usd_24h_change || 0;
            const changeAbs = price * (changePct / 100);

            quotesMap[origSymbol] = new Quote({
                symbol: origSymbol,
                price: price,
                change: changeAbs,
                changePercent: changePct,
                currency: 'USD',
                volume: data.usd_24h_vol || null,
                marketState: '24/7',
                timestamp: Date.now()
            });
        }
        return quotesMap;
    }
}
