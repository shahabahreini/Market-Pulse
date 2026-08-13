/* Market Pulse — market session calendar
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export class MarketHours {
    static isCrypto(symbol) {
        if (!symbol) return false;
        const upper = symbol.toUpperCase();
        return upper.endsWith('-USD') || upper.endsWith('-EUR') || upper.endsWith('USDT') || upper.includes('BTC') || upper.includes('ETH');
    }

    static getMarketStatus(symbol, quoteState = null) {
        if (MarketHours.isCrypto(symbol)) {
            return { state: '24/7', isOpen: true, label: '24/7 Market' };
        }

        if (quoteState) {
            const stateUpper = quoteState.toUpperCase();
            if (stateUpper === 'REGULAR') return { state: 'REGULAR', isOpen: true, label: 'Market Open' };
            if (stateUpper === 'PRE') return { state: 'PRE', isOpen: false, label: 'Pre-Market' };
            if (stateUpper === 'POST') return { state: 'POST', isOpen: false, label: 'After-Hours' };
            if (stateUpper === 'CLOSED') return { state: 'CLOSED', isOpen: false, label: 'Market Closed' };
        }

        // General fallback estimation based on UTC hours (US equities: 14:30 - 21:00 UTC Mon-Fri)
        const now = new Date();
        const day = now.getUTCDay();
        if (day === 0 || day === 6) {
            return { state: 'CLOSED', isOpen: false, label: 'Weekend Closed' };
        }

        const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
        const openUTC = 14 * 60 + 30;  // 14:30 UTC
        const closeUTC = 21 * 60;       // 21:00 UTC

        if (utcMinutes >= openUTC && utcMinutes < closeUTC) {
            return { state: 'REGULAR', isOpen: true, label: 'Market Open' };
        }
        if (utcMinutes >= openUTC - 300 && utcMinutes < openUTC) {
            return { state: 'PRE', isOpen: false, label: 'Pre-Market' };
        }
        if (utcMinutes >= closeUTC && utcMinutes < closeUTC + 240) {
            return { state: 'POST', isOpen: false, label: 'After-Hours' };
        }

        return { state: 'CLOSED', isOpen: false, label: 'Market Closed' };
    }
}
