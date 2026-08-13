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

        const secids = chinaSymbols.map(s => {
            if (s.startsWith('6') || s.startsWith('sh')) return `1.${s.replace('sh', '')}`;
            return `0.${s.replace('sz', '')}`;
        }).join(',');

        const url = `https://push2.eastmoney.com/api/qt/ulist/get?secids=${secids}&fields=f2,f3,f4,f12,f14`;
        const json = await this._httpGetJson(url, {}, cancellable);

        if (!json || !json.data || !json.data.diff) return {};

        const quotesMap = {};
        for (const item of json.data.diff) {
            const code = item.f12;
            const price = (item.f2 ?? 0) / 100;
            const changePct = (item.f3 ?? 0) / 100;
            const changeAbs = (item.f4 ?? 0) / 100;

            quotesMap[code] = new Quote({
                symbol: code,
                price: price,
                change: changeAbs,
                changePercent: changePct,
                currency: 'CNY',
                marketState: 'REGULAR',
                timestamp: Date.now()
            });
        }
        return quotesMap;
    }

    async searchSymbols(query, cancellable = null) {
        if (!query || query.trim().length === 0) return [];
        const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(query)}&type=14`;
        const json = await this._httpGetJson(url, {}, cancellable);

        if (!json || !json.QuotationCodeTable || !json.QuotationCodeTable.Data) return [];

        return json.QuotationCodeTable.Data.map(item => ({
            symbol: item.Code,
            name: item.Name,
            type: 'equity',
            exchange: item.MarketType === '1' ? 'SH' : 'SZ',
            provider: 'eastmoney'
        }));
    }
}
