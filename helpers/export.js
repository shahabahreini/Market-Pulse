/**
 * Market Pulse — Import / Export Helper
 *
 * Pure string building only — NO gi imports. This module is reachable from
 * extension.js, and pulling Gtk/Gdk into the gnome-shell process is an
 * automatic extensions.gnome.org rejection. Clipboard access lives in the
 * process-specific shims: helpers/clipboardShell.js and helpers/clipboardPrefs.js.
 *
 * GPL-3.0 License
 */

export class ExportHelper {
    static exportPortfolioToJson(portfolio) {
        try {
            return JSON.stringify(portfolio, null, 2);
        } catch (e) {
            console.error(`[market-pulse] JSON export error: ${e.message}`);
            return null;
        }
    }

    static exportHoldingsToCsv(portfolio, quotesMap = {}) {
        if (!portfolio || !portfolio.symbols) return '';

        const headers = ['Symbol', 'Name', 'Asset Type', 'Quantity', 'Buy Price', 'Current Price', 'Position Value', 'Total Gain', 'Gain %'];
        const rows = [headers.join(',')];

        for (const symObj of portfolio.symbols) {
            const holding = portfolio.holdings[symObj.symbol] || { quantity: 0, buyPrice: 0 };
            const quote = quotesMap[symObj.symbol];
            const currentPrice = quote ? quote.price : holding.buyPrice;
            const posValue = holding.quantity * currentPrice;
            const totalCost = holding.quantity * holding.buyPrice;
            const totalGain = posValue - totalCost;
            const gainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

            const row = [
                `"${symObj.symbol}"`,
                `"${(symObj.name || '').replace(/"/g, '""')}"`,
                `"${symObj.type}"`,
                holding.quantity,
                holding.buyPrice,
                currentPrice,
                posValue.toFixed(2),
                totalGain.toFixed(2),
                `${gainPct.toFixed(2)}%`
            ];
            rows.push(row.join(','));
        }

        return rows.join('\n');
    }

    /**
     * Parses an exported portfolio JSON back into a plain object, rejecting
     * anything that does not match the expected DTO shape (plan §0.4).
     */
    static parsePortfolioJson(text) {
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object') {
            throw new Error('Not a portfolio object');
        }
        if (!Array.isArray(data.symbols)) {
            throw new Error('Missing "symbols" array');
        }
        const symbols = data.symbols
            .filter(s => s && typeof s.symbol === 'string' && s.symbol.length > 0)
            .map(s => ({
                symbol: s.symbol,
                name: typeof s.name === 'string' ? s.name : s.symbol,
                type: typeof s.type === 'string' ? s.type : 'equity',
                provider: typeof s.provider === 'string' ? s.provider : 'yahoo',
                currency: typeof s.currency === 'string' ? s.currency : 'USD',
                exchange: typeof s.exchange === 'string' ? s.exchange : ''
            }));

        if (symbols.length === 0) {
            throw new Error('No valid symbols found');
        }

        const holdings = {};
        for (const [sym, h] of Object.entries(data.holdings || {})) {
            if (!h || typeof h !== 'object') continue;
            holdings[sym] = {
                symbol: sym,
                quantity: Number(h.quantity) || 0,
                buyPrice: Number(h.buyPrice) || 0,
                notes: typeof h.notes === 'string' ? h.notes : ''
            };
        }

        return {
            id: typeof data.id === 'string' ? data.id : 'default',
            name: typeof data.name === 'string' ? data.name : 'Imported Portfolio',
            symbols,
            holdings
        };
    }
}
