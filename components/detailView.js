/**
 * Market Pulse — Symbol Detail Card & Extended Stats Component
 * GPL-3.0 License
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import { ChartCanvas } from './chart.js';
import { Formatter } from '../helpers/formatter.js';
import { MarketHours } from '../helpers/marketHours.js';

export const DetailView = GObject.registerClass(
class DetailView extends St.BoxLayout {
    _init(providerRegistry) {
        super._init({
            vertical: true,
            style_class: 'market-pulse-detail-view',
            x_expand: true,
            y_expand: false
        });

        this._registry = providerRegistry;
        this._currentSymbol = null;

        // Top Header
        this._headerBox = new St.BoxLayout({ vertical: false, style_class: 'market-pulse-detail-header' });
        this._titleLabel = new St.Label({ text: 'Symbol Details', style_class: 'market-pulse-detail-title' });
        this._marketStatusBadge = new St.Label({ text: '', style_class: 'market-pulse-status-badge' });
        this._headerBox.add_child(this._titleLabel);
        this._headerBox.add_child(this._marketStatusBadge);
        this.add_child(this._headerBox);

        // Interactive Cairo Chart
        this._chart = new ChartCanvas(320, 150);
        this.add_child(this._chart);

        // Chart Timeframe Selector Buttons
        this._tfBox = new St.BoxLayout({ vertical: false, style_class: 'market-pulse-tf-box' });
        const timeframes = [
            { label: '1D', range: '1d', int: '5m' },
            { label: '1M', range: '1mo', int: '1d' },
            { label: '6M', range: '6mo', int: '1wk' },
            { label: '1Y', range: '1y', int: '1wk' },
            { label: '5Y', range: '5y', int: '1mo' }
        ];

        for (const tf of timeframes) {
            const btn = new St.Button({
                label: tf.label,
                style_class: 'button market-pulse-tf-btn'
            });
            btn.connect('clicked', () => this.loadChartData(tf.range, tf.int));
            this._tfBox.add_child(btn);
        }
        this.add_child(this._tfBox);

        // 2-Column Key Statistics Grid
        this._statsGrid = new St.BoxLayout({ vertical: true, style_class: 'market-pulse-stats-grid' });
        this.add_child(this._statsGrid);
    }

    setQuoteData(symbolObj, quote) {
        this._currentSymbol = symbolObj;
        this._quote = quote;

        if (!quote) {
            this._titleLabel.set_text(symbolObj?.name || 'Loading...');
            return;
        }

        const mStatus = MarketHours.getMarketStatus(symbolObj.symbol, quote.marketState);
        this._titleLabel.set_text(`${symbolObj.name} (${quote.symbol})`);
        this._marketStatusBadge.set_text(mStatus.label);

        // Clear existing stats grid rows
        this._statsGrid.destroy_all_children();

        const isMasked = false; // Detail stats
        const stats = [
            { label: 'Open', val: Formatter.formatCurrency(quote.open, quote.currency) },
            { label: 'High', val: Formatter.formatCurrency(quote.high, quote.currency) },
            { label: 'Low', val: Formatter.formatCurrency(quote.low, quote.currency) },
            { label: 'Prev Close', val: Formatter.formatCurrency(quote.previousClose, quote.currency) },
            { label: 'Volume', val: Formatter.formatNumber(quote.volume) },
            { label: 'Market Cap', val: Formatter.formatNumber(quote.marketCap) },
            { label: 'P/E Ratio', val: quote.peRatio ? quote.peRatio.toFixed(2) : '—' },
            { label: 'Div Yield', val: quote.dividendYield ? `${quote.dividendYield.toFixed(2)}%` : '—' }
        ];

        for (let i = 0; i < stats.length; i += 2) {
            const rowBox = new St.BoxLayout({ vertical: false, style_class: 'market-pulse-stats-row' });
            
            const col1 = new St.Label({
                text: `${stats[i].label}: ${stats[i].val}`,
                style_class: 'market-pulse-stat-cell',
                x_expand: true
            });
            rowBox.add_child(col1);

            if (i + 1 < stats.length) {
                const col2 = new St.Label({
                    text: `${stats[i + 1].label}: ${stats[i + 1].val}`,
                    style_class: 'market-pulse-stat-cell',
                    x_expand: true
                });
                rowBox.add_child(col2);
            }

            this._statsGrid.add_child(rowBox);
        }

        // Fetch initial 1D chart
        this.loadChartData('1d', '5m');
    }

    async loadChartData(range = '1d', interval = '5m') {
        if (!this._currentSymbol) return;
        const provider = this._registry.getProvider(this._currentSymbol.provider || 'yahoo') || this._registry.getProvider('yahoo');
        if (!provider || !provider.fetchChartData) return;

        try {
            const points = await provider.fetchChartData(this._currentSymbol.symbol, range, interval);
            this._chart.setData(points, this._quote?.currency || 'USD');
        } catch (e) {
            console.warn(`[market-pulse] Error loading chart for ${this._currentSymbol.symbol}: ${e.message}`);
        }
    }
});
