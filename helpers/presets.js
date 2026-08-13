/* Market Pulse — starter watchlists
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * One-click bundles, so a new user has something on screen before they know
 * what ticker symbol to type. Shapes match the SymbolData constructor.
 */
export const PRESETS = [
    {
        id: 'indices',
        label: 'Major indices',
        description: 'S&P 500, NASDAQ, Dow Jones',
        symbols: [
            { symbol: '^GSPC', name: 'S&P 500', type: 'index', provider: 'yahoo' },
            { symbol: '^IXIC', name: 'NASDAQ Composite', nickname: 'NASDAQ', type: 'index', provider: 'yahoo' },
            { symbol: '^DJI', name: 'Dow Jones Industrial Average', nickname: 'Dow', type: 'index', provider: 'yahoo' }
        ]
    },
    {
        id: 'us-stocks',
        label: 'Popular US stocks',
        description: 'Apple, Microsoft, Amazon, Tesla',
        symbols: [
            { symbol: 'AAPL', name: 'Apple Inc.', type: 'equity', provider: 'yahoo' },
            { symbol: 'MSFT', name: 'Microsoft Corporation', nickname: 'Microsoft', type: 'equity', provider: 'yahoo' },
            { symbol: 'AMZN', name: 'Amazon.com, Inc.', nickname: 'Amazon', type: 'equity', provider: 'yahoo' },
            { symbol: 'TSLA', name: 'Tesla, Inc.', nickname: 'Tesla', type: 'equity', provider: 'yahoo' }
        ]
    },
    {
        id: 'crypto',
        label: 'Crypto',
        description: 'Bitcoin, Ethereum, Solana',
        symbols: [
            { symbol: 'BTC-USD', name: 'Bitcoin USD', nickname: 'Bitcoin', type: 'crypto', provider: 'yahoo' },
            { symbol: 'ETH-USD', name: 'Ethereum USD', nickname: 'Ethereum', type: 'crypto', provider: 'yahoo' },
            { symbol: 'SOL-USD', name: 'Solana USD', nickname: 'Solana', type: 'crypto', provider: 'yahoo' }
        ]
    },
    {
        id: 'etfs',
        label: 'Broad-market ETFs',
        description: 'Total market, S&P 500, world',
        symbols: [
            { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', nickname: 'Total Mkt', type: 'etf', provider: 'yahoo' },
            { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', nickname: 'SPY', type: 'etf', provider: 'yahoo' },
            { symbol: 'VT', name: 'Vanguard Total World Stock ETF', nickname: 'World', type: 'etf', provider: 'yahoo' }
        ]
    }
];

export function getPreset(id) {
    return PRESETS.find(p => p.id === id) || null;
}
