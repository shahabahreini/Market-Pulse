/* Market Pulse — portfolio value and P&L
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Formatter } from '../helpers/formatter.js';

export class PortfolioCalculator {
    static calculatePortfolioSummary(portfolio, quotesMap, isMasked = false) {
        let totalValue = 0;
        let totalCost = 0;
        let dayGain = 0;
        let hasHoldings = false;

        if (!portfolio || !portfolio.holdings) {
            return { totalValue: 0, totalCost: 0, totalGain: 0, totalGainPct: 0, dayGain: 0, isMasked };
        }

        for (const [sym, holding] of Object.entries(portfolio.holdings)) {
            if (!holding || holding.quantity <= 0) continue;
            hasHoldings = true;

            const quote = quotesMap[sym];
            const currentPrice = quote ? quote.price : holding.buyPrice;
            const changeAbs = quote ? quote.change : 0;

            const val = holding.quantity * currentPrice;
            const cost = holding.quantity * holding.buyPrice;

            totalValue += val;
            totalCost += cost;
            dayGain += holding.quantity * changeAbs;
        }

        const totalGain = totalValue - totalCost;
        const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

        return {
            totalValue,
            totalCost,
            totalGain,
            totalGainPct,
            dayGain,
            hasHoldings,
            isMasked
        };
    }

    static formatValueOrMask(val, currency = 'USD', isMasked = false, isCurrency = true) {
        if (isMasked) return '••••••';
        return isCurrency ? Formatter.formatCurrency(val, currency) : Formatter.formatNumber(val);
    }
}
