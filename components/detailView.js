/* Market Pulse — symbol detail card
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import { ChartCanvas } from './chart.js';
import { Formatter } from '../helpers/formatter.js';
import { copyToClipboard } from '../helpers/clipboardShell.js';
import { MarketHours } from '../helpers/marketHours.js';

const TIMEFRAMES = [
    { label: '1D', range: '1d', interval: '5m' },
    { label: '1M', range: '1mo', interval: '1d' },
    { label: '6M', range: '6mo', interval: '1wk' },
    { label: '1Y', range: '1y', interval: '1wk' },
    { label: '5Y', range: '5y', interval: '1mo' }
];

export const DetailView = GObject.registerClass(
class DetailView extends St.BoxLayout {
    _init(providerRegistry, settingsHelper) {
        super._init({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'market-pulse-detail-view',
            x_expand: true,
            y_expand: false
        });

        this._registry = providerRegistry;
        this._settings = settingsHelper;
        this._currentSymbol = null;
        this._quote = null;
        this._range = '1d';
        this._interval = '5m';
        this._chartSerial = 0;
        this._comparisonSymbols = [];
        this._headerBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'market-pulse-detail-header'
        });
        this._titleLabel = new St.Label({
            text: 'Symbol Details',
            style_class: 'market-pulse-detail-title',
            x_expand: true
        });
        this._marketStatusBadge = new St.Label({ text: '', style_class: 'market-pulse-status-badge' });

        this._copyBtn = new St.Button({
            child: new St.Icon({ icon_name: 'edit-copy-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            accessible_name: 'Copy quote to clipboard'
        });
        this._copyBtn.connect('clicked', () => this._copyQuote());

        // Detach into the always-on-top desktop widget.
        this._popOutBtn = new St.Button({
            child: new St.Icon({ icon_name: 'view-restore-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            accessible_name: 'Open as desktop widget'
        });
        this._popOutBtn.connect('clicked', () => {
            if (this._currentSymbol) this._onPopOut?.(this._currentSymbol);
        });

        this._headerBox.add_child(this._titleLabel);
        this._headerBox.add_child(this._marketStatusBadge);
        this._headerBox.add_child(this._popOutBtn);
        this._headerBox.add_child(this._copyBtn);
        this.add_child(this._headerBox);
        this._noticeLabel = new St.Label({ text: '', style_class: 'market-pulse-detail-notice' });
        this._noticeLabel.hide();
        this.add_child(this._noticeLabel);
        this._chart = new ChartCanvas(320, 150);
        this.add_child(this._chart);
        this._tfBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'market-pulse-tf-box'
        });
        this._tfButtons = new Map();
        for (const tf of TIMEFRAMES) {
            const btn = new St.Button({
                label: tf.label,
                style_class: 'button market-pulse-tf-btn',
                accessible_name: `Show ${tf.label} chart`
            });
            btn.connect('clicked', () => {
                this._range = tf.range;
                this._interval = tf.interval;
                this._syncTimeframeButtons();
                this.loadChartData();
            });
            this._tfBox.add_child(btn);
            this._tfButtons.set(tf.range, btn);
        }

        // Comparison toggle: overlays the other portfolio symbols
        // as normalized percent series.
        this._compareBtn = new St.Button({
            label: 'Compare',
            style_class: 'button market-pulse-tf-btn market-pulse-compare-btn',
            accessible_name: 'Toggle comparison overlay'
        });
        this._compareBtn.connect('clicked', () => this._toggleComparison());
        this._tfBox.add_child(this._compareBtn);

        this.add_child(this._tfBox);
        this._statsGrid = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'market-pulse-stats-grid'
        });
        this.add_child(this._statsGrid);

        this.connect('destroy', () => {
            this._chartSerial++;   // invalidate any in-flight chart fetch
            this._currentSymbol = null;
            this._quote = null;
            this._onPopOut = null;
        });
    }

    setPopOutHandler(handler) {
        this._onPopOut = handler;
    }

    _syncTimeframeButtons() {
        for (const [range, btn] of this._tfButtons) {
            if (range === this._range) btn.add_style_class_name('selected');
            else btn.remove_style_class_name('selected');
        }
    }

    _copyQuote() {
        if (!this._quote || !this._currentSymbol) return;
        const text = `${this._currentSymbol.name} (${this._quote.symbol}): ` +
            `${Formatter.formatCurrency(this._quote.price, this._quote.currency)} ` +
            `(${Formatter.formatPercent(this._quote.changePercent)})`;
        copyToClipboard(text);
    }

    setQuoteData(symbolObj, quote) {
        this._currentSymbol = symbolObj;
        this._quote = quote;
        this._comparisonSymbols = [];
        this._syncTimeframeButtons();

        if (!quote) {
            this._titleLabel.set_text(symbolObj?.name || 'Loading…');
            this._marketStatusBadge.set_text('');
            this._showNotice('Waiting for the first quote…');
            this._statsGrid.destroy_all_children();
            this._chart.clear();
            return;
        }

        const mStatus = MarketHours.getMarketStatus(symbolObj.symbol, quote.marketState);
        this._titleLabel.set_text(`${symbolObj.name} (${quote.symbol})`);
        this._marketStatusBadge.set_text(mStatus.label);

        // Per-symbol error and staleness states.
        if (quote.error) {
            this._showNotice(`${quote.error} — showing last known values from ${Formatter.formatTime(quote.timestamp)}`);
        } else if (quote.isStale?.()) {
            this._showNotice(`Cached quote from ${Formatter.formatTime(quote.timestamp)}`);
        } else if (quote.providerUsed && quote.providerUsed !== (symbolObj.provider || 'yahoo')) {
            this._showNotice(`Served by ${quote.providerUsed} (failover)`);
        } else {
            this._noticeLabel.hide();
        }

        this._renderStats(quote);
        this.loadChartData();
    }

    _showNotice(text) {
        this._noticeLabel.set_text(text);
        this._noticeLabel.show();
    }

    _renderStats(quote) {
        this._statsGrid.destroy_all_children();

        const stats = [
            { label: 'Open', val: Formatter.formatCurrency(quote.open, quote.currency) },
            { label: 'High', val: Formatter.formatCurrency(quote.high, quote.currency) },
            { label: 'Low', val: Formatter.formatCurrency(quote.low, quote.currency) },
            { label: 'Prev Close', val: Formatter.formatCurrency(quote.previousClose, quote.currency) },
            { label: 'Volume', val: Formatter.formatNumber(quote.volume) },
            { label: 'Market Cap', val: Formatter.formatNumber(quote.marketCap) },
            { label: 'P/E Ratio', val: quote.peRatio ? quote.peRatio.toFixed(2) : '—' },
            // Dividends & earnings where the provider supplies them.
            { label: 'Div Yield', val: quote.dividendYield ? `${quote.dividendYield.toFixed(2)}%` : '—' },
            { label: 'Next Earnings', val: Formatter.formatDate(quote.earningsDate) },
            { label: 'Exchange', val: quote.exchangeName || '—' }
        ];

        for (let i = 0; i < stats.length; i += 2) {
            const rowBox = new St.BoxLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                style_class: 'market-pulse-stats-row'
            });

            rowBox.add_child(new St.Label({
                text: `${stats[i].label}: ${stats[i].val}`,
                style_class: 'market-pulse-stat-cell',
                x_expand: true
            }));

            if (i + 1 < stats.length) {
                rowBox.add_child(new St.Label({
                    text: `${stats[i + 1].label}: ${stats[i + 1].val}`,
                    style_class: 'market-pulse-stat-cell',
                    x_expand: true
                }));
            }

            this._statsGrid.add_child(rowBox);
        }
    }

    _toggleComparison() {
        if (this._comparisonSymbols.length > 0) {
            this._comparisonSymbols = [];
            this._compareBtn.remove_style_class_name('selected');
        } else {
            // Up to two peers from the active portfolio(2–3 series).
            const portfolio = this._settings?.getActivePortfolio();
            this._comparisonSymbols = (portfolio?.symbols ?? [])
                .filter(s => s.symbol !== this._currentSymbol?.symbol)
                .slice(0, 2);
            this._compareBtn.add_style_class_name('selected');
        }
        this.loadChartData();
    }

    _providerFor(symbolObj) {
        return this._registry.getProvider(symbolObj.provider || 'yahoo') || this._registry.getProvider('yahoo');
    }

    async loadChartData() {
        if (!this._currentSymbol) return;

        // Stale-response guard: timeframe clicks can outrun their fetches.
        const serial = ++this._chartSerial;

        try {
            const targets = [this._currentSymbol, ...this._comparisonSymbols];
            const series = [];

            for (const symObj of targets) {
                const provider = this._providerFor(symObj);
                if (!provider?.fetchChartData) continue;

                const points = await provider.fetchChartData(symObj.symbol, this._range, this._interval);
                if (serial !== this._chartSerial) return;
                if (points.length > 1) {
                    series.push({ label: symObj.symbol, points });
                }
            }

            if (serial !== this._chartSerial || !this._chart) return;

            if (series.length === 0) {
                this._chart.clear();
            } else if (this._comparisonSymbols.length > 0) {
                this._chart.setComparisonData(series, this._quote?.currency || 'USD');
            } else {
                this._chart.setData(series[0].points, this._quote?.currency || 'USD', series[0].label);
            }
        } catch (e) {
            console.warn(`[market-pulse] Error loading chart for ${this._currentSymbol.symbol}: ${e.message}`);
            if (serial === this._chartSerial) this._chart?.clear();
        }
    }
});
