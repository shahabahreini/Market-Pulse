/**
 * Market Pulse — Eastmoney Provider Adapter (China Markets)
 * GPL-3.0 License
 */

import { BaseQuoteProvider } from '../quoteProvider.js';
import { Quote } from '../../helpers/models.js';

export class EastmoneyProvider extends BaseQuoteProvider {
    constructor() {
        super('eastmoney', 'Eastmoney (China)', ['equity', 'etf', 'index']);
    }

    async fetchQuotes(symbols, cancellable = null) {
        if (!symbols || symbols.length === 0) return {};
        // Filter for Chinese market symbols (e.g. 000001, 600519)
        const chinaSymbols = symbols.filter(s => /^\d{6}$/.test(s) || s.startsWith('sh') || s.startsWith('sz'));
        if (chinaSymbols.length === 0) return {};

        // The bare 6-digit code is ambiguous (000001 is both the SSE Composite
        // and Ping An Bank), so keep a secid → requested-symbol map and key the
        // results by what the caller actually asked for.
        const secidToSymbol = new Map();
        for (const s of chinaSymbols) {
            const secid = (s.startsWith('6') || s.startsWith('sh'))
                ? `1.${s.replace('sh', '')}`
                : `0.${s.replace('sz', '')}`;
            secidToSymbol.set(secid, s);
        }
        const secids = Array.from(secidToSymbol.keys()).join(',');

        // ulist.np + fltt=2 returns already-scaled decimals; the plain ulist
        // endpoint answers rc:102 with a null payload.
        const url = 'https://push2.eastmoney.com/api/qt/ulist.np/get' +
            `?secids=${secids}&fields=f2,f3,f4,f12,f13,f14,f17,f15,f16,f18,f5` +
            '&fltt=2&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281';
        const json = await this._httpGetJson(url, {}, cancellable);

        if (!json || json.rc !== 0 || !json.data || !Array.isArray(json.data.diff)) return {};

        const quotesMap = {};
        for (const item of json.data.diff) {
            const code = item.f12;
            if (!code || item.f2 === '-' || item.f2 === undefined) continue;

            // f13 is the market id (1 = Shanghai, 0 = Shenzhen).
            const requested = secidToSymbol.get(`${item.f13}.${code}`) ?? code;

            quotesMap[requested] = new Quote({
                symbol: requested,
                price: Number(item.f2) || 0,
                change: Number(item.f4) || 0,
                changePercent: Number(item.f3) || 0,
                currency: 'CNY',
                open: this._numOrNull(item.f17),
                high: this._numOrNull(item.f15),
                low: this._numOrNull(item.f16),
                previousClose: this._numOrNull(item.f18),
                volume: this._numOrNull(item.f5),
                marketState: 'REGULAR',
                exchangeName: item.f14 || '',
                providerUsed: this.id,
                timestamp: Date.now()
            });
        }
        return quotesMap;
    }

    _numOrNull(value) {
        if (value === undefined || value === null || value === '-') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    async searchSymbols(query, cancellable = null) {
        if (!query || query.trim().length === 0) return [];
        const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(query)}&type=14`;
        const json = await this._httpGetJson(url, {}, cancellable);

        if (!json || !json.QuotationCodeTable || !json.QuotationCodeTable.Data) return [];

        // Emit market-prefixed symbols so the exchange survives into fetchQuotes.
        return json.QuotationCodeTable.Data
            .filter(item => item.Code)
            .map(item => {
                const isShanghai = item.MarketType === '1';
                return {
                    symbol: `${isShanghai ? 'sh' : 'sz'}${item.Code}`,
                    name: item.Name || item.Code,
                    type: 'equity',
                    exchange: isShanghai ? 'SH' : 'SZ',
                    provider: 'eastmoney'
                };
            });
    }
}
