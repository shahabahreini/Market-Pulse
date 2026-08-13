/* Market Pulse — data models
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export class SymbolData {
    constructor({ symbol, name, nickname = '', type = 'equity', provider = 'yahoo', currency = 'USD', exchange = '' }) {
        this.symbol = symbol;
        this.name = name || symbol;
        this.nickname = nickname;  // short user label for the top bar
        this.type = type; // 'equity', 'etf', 'index', 'crypto', 'forex'
        this.provider = provider;
        this.currency = currency;
        this.exchange = exchange;
    }

    /**
     * What the user should see. A prototype getter rather than a field, so
     * JSON.stringify still round-trips exactly the stored properties.
     */
    get displayLabel() {
        return this.nickname || this.name || this.symbol;
    }
}

export class Quote {
    constructor({
        symbol,
        price = 0,
        change = 0,
        changePercent = 0,
        currency = 'USD',
        high = null,
        low = null,
        open = null,
        previousClose = null,
        volume = null,
        marketCap = null,
        peRatio = null,
        dividendYield = null,
        earningsDate = null,
        marketState = 'REGULAR', // 'PRE', 'REGULAR', 'POST', 'CLOSED'
        timestamp = Date.now(),
        sparkline = [],
        exchangeName = '',
        providerUsed = null,
        error = null
    }) {
        this.symbol = symbol;
        this.price = Number(price) || 0;
        this.change = Number(change) || 0;
        this.changePercent = Number(changePercent) || 0;
        this.currency = currency;
        this.high = high !== null ? Number(high) : null;
        this.low = low !== null ? Number(low) : null;
        this.open = open !== null ? Number(open) : null;
        this.previousClose = previousClose !== null ? Number(previousClose) : null;
        this.volume = volume !== null ? Number(volume) : null;
        this.marketCap = marketCap !== null ? Number(marketCap) : null;
        this.peRatio = peRatio !== null ? Number(peRatio) : null;
        this.dividendYield = dividendYield !== null ? Number(dividendYield) : null;
        this.earningsDate = earningsDate;
        this.marketState = marketState;
        this.timestamp = timestamp;
        this.sparkline = Array.isArray(sparkline) ? sparkline : [];
        this.exchangeName = exchangeName;
        this.providerUsed = providerUsed;   // which adapter answered (failover hint)
        this.error = error;                 // last per-symbol failure, for the error badge
    }

    /** True when this quote came from the offline cache rather than a live poll. */
    isStale(maxAgeMs = 10 * 60 * 1000) {
        return Date.now() - this.timestamp > maxAgeMs;
    }
}

export class Holding {
    constructor({ symbol, quantity = 0, buyPrice = 0, notes = '' }) {
        this.symbol = symbol;
        this.quantity = Number(quantity) || 0;
        this.buyPrice = Number(buyPrice) || 0;
        this.notes = notes;
    }

    get totalCost() {
        return this.quantity * this.buyPrice;
    }

    calculateValue(currentPrice) {
        return this.quantity * currentPrice;
    }

    calculateGain(currentPrice) {
        const value = this.calculateValue(currentPrice);
        const cost = this.totalCost;
        return {
            amount: value - cost,
            percent: cost > 0 ? ((value - cost) / cost) * 100 : 0
        };
    }
}

export class Portfolio {
    constructor({ id = 'default', name = 'Main Portfolio', symbols = [], holdings = {} }) {
        this.id = id;
        this.name = name;
        this.symbols = symbols.map(s => s instanceof SymbolData ? s : new SymbolData(s));
        this.holdings = {};
        for (const [sym, h] of Object.entries(holdings || {})) {
            this.holdings[sym] = h instanceof Holding ? h : new Holding(h);
        }
    }
}

export class AlertRule {
    constructor({ id, symbol, condition, threshold, enabled = true, createdAt = Date.now() }) {
        this.id = id || `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.symbol = symbol;
        this.condition = condition; // 'ABOVE_PRICE', 'BELOW_PRICE', 'GAIN_PCT', 'LOSS_PCT'
        this.threshold = Number(threshold) || 0;
        this.enabled = enabled;
        this.createdAt = createdAt;
    }
}
