/**
 * Market Pulse — Import / Export & Clipboard Helper
 * GPL-3.0 License
 */

import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import { Formatter } from './formatter.js';

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
                `"${symObj.name.replace(/"/g, '""')}"`,
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

    static copyToClipboard(text) {
        try {
            const display = Gdk.Display.get_default();
            if (display) {
                const clipboard = display.get_clipboard();
                clipboard.set(text);
                return true;
            }
        } catch (e) {
            console.error(`[market-pulse] Clipboard copy error: ${e.message}`);
        }
        return false;
    }
}
