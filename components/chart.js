/* Market Pulse — chart drawing area
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import { Formatter } from '../helpers/formatter.js';

// Soft, low-saturation palette (.4). Index 0 is the primary series.
const SERIES_COLORS = [
    [0.20, 0.83, 0.60],
    [0.45, 0.60, 0.95],
    [0.95, 0.70, 0.35]
];
const SERIES_COLORS_CB = [
    [0.22, 0.58, 0.96],
    [0.96, 0.55, 0.18],
    [0.55, 0.55, 0.60]
];
const DOWN_COLOR = [0.96, 0.42, 0.42];
const DOWN_COLOR_CB = [0.96, 0.55, 0.18];

const ANIMATION_MS = 250;

export const ChartCanvas = GObject.registerClass(
class ChartCanvas extends St.DrawingArea {
    _init(width = 320, height = 160, isColorblind = false) {
        super._init({
            width: width,
            height: height,
            style_class: 'market-pulse-chart-canvas',
            x_expand: true,
            y_expand: false
        });

        this._series = [];       // [{ label, points: [{time, price}], color }]
        this._currency = 'USD';
        this._isColorblind = isColorblind;
        this._comparisonMode = false;
        this._progress = 1;      // 0→1 reveal used for the ease-out transition
        this._timeline = null;

        this.connect('repaint', this._onRepaint.bind(this));
        this.connect('destroy', () => this._stopAnimation());
    }

    /** Single-series price chart. */
    setData(points, currency = 'USD', label = '') {
        this._comparisonMode = false;
        this._currency = currency;
        this._series = [{ label, points: Array.isArray(points) ? points : [] }];
        this._animateIn();
    }

    /** Comparison overlay: each entry is { label, points }. */
    setComparisonData(seriesList, currency = 'USD') {
        this._comparisonMode = true;
        this._currency = currency;
        this._series = (seriesList || [])
            .filter(s => Array.isArray(s.points) && s.points.length > 1)
            .slice(0, 3);
        this._animateIn();
    }

    clear() {
        this._stopAnimation();
        this._series = [];
        this.queue_repaint();
    }

    _animateIn() {
        this._stopAnimation();
        if (!this.is_visible()) {
            this._progress = 1;
            return;
        }

        this._progress = 0;

        // Driven by the actor's frame clock, so it stops with the actor and
        // never runs while the menu is closed.
        this._timeline = new Clutter.Timeline({
            actor: this,
            duration: ANIMATION_MS,
            progress_mode: Clutter.AnimationMode.EASE_OUT_CUBIC
        });
        this._timeline.connect('new-frame', () => {
            this._progress = this._timeline.get_progress();
            this.queue_repaint();
        });
        this._timeline.connect('completed', () => {
            this._progress = 1;
            this._stopAnimation();
            this.queue_repaint();
        });
        this._timeline.start();
    }

    _stopAnimation() {
        if (this._timeline) {
            this._timeline.stop();
            this._timeline = null;
        }
    }

    _palette() {
        return this._isColorblind ? SERIES_COLORS_CB : SERIES_COLORS;
    }

    _onRepaint(area) {
        // Lazy draw: nothing is rendered while the menu is closed.
        if (!area.is_visible()) return;

        const cr = area.get_context();
        try {
            this._draw(cr, area);
        } finally {
            // Cairo contexts are not GC-managed in GJS — an undisposed context
            // leaks the surface on every single repaint.
            cr.$dispose();
        }
    }

    _draw(cr, area) {
        const [width, height] = area.get_surface_size();

        cr.save();
        cr.setOperator(0); // CLEAR
        cr.paint();
        cr.restore();

        const drawable = this._series.filter(s => s.points.length >= 2);
        if (drawable.length === 0) {
            this._drawPlaceholder(cr, width, height);
            return;
        }

        const padLeft = 10;
        const padRight = 10;
        const padTop = 20;
        const padBottom = 20;
        const chartW = width - padLeft - padRight;
        const chartH = height - padTop - padBottom;

        // Comparison mode plots percent change from each series' first point,
        // so a $60k asset and a $150 asset share one vertical scale.
        const valuesFor = (series) => this._comparisonMode
            ? series.points.map(p => ((p.price - series.points[0].price) / series.points[0].price) * 100)
            : series.points.map(p => p.price);

        const allValues = drawable.flatMap(valuesFor);
        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);
        const range = maxVal - minVal || 1;

        this._drawGrid(cr, padLeft, padTop, width - padRight, chartH);

        const palette = this._palette();

        drawable.forEach((series, index) => {
            const values = valuesFor(series);
            const visibleCount = Math.max(2, Math.ceil(values.length * this._progress));
            const stepX = chartW / (values.length - 1);

            let color;
            if (this._comparisonMode) {
                color = palette[index % palette.length];
            } else {
                const isUp = values[values.length - 1] >= values[0];
                color = isUp ? palette[0] : (this._isColorblind ? DOWN_COLOR_CB : DOWN_COLOR);
            }

            cr.newPath();
            for (let i = 0; i < visibleCount; i++) {
                const x = padLeft + i * stepX;
                const y = padTop + chartH - ((values[i] - minVal) / range) * chartH;
                if (i === 0) cr.moveTo(x, y);
                else cr.lineTo(x, y);
            }

            cr.setSourceRGBA(color[0], color[1], color[2], 1.0);
            cr.setLineWidth(this._comparisonMode ? 1.6 : 2.0);
            cr.strokePreserve();

            // Area fill only for the single-series view; overlaid fills muddy
            // a comparison chart.
            if (!this._comparisonMode) {
                const lastX = padLeft + (visibleCount - 1) * stepX;
                cr.lineTo(lastX, height - padBottom);
                cr.lineTo(padLeft, height - padBottom);
                cr.closePath();
                cr.setSourceRGBA(color[0], color[1], color[2], 0.12);
                cr.fill();
            } else {
                cr.newPath();
            }
        });

        if (this._comparisonMode) {
            this._drawComparisonLegend(cr, drawable, padLeft, height);
            this._drawAxisLabel(cr, `${maxVal >= 0 ? '+' : ''}${maxVal.toFixed(1)}%`, padLeft, 12);
            this._drawAxisLabel(cr, `${minVal >= 0 ? '+' : ''}${minVal.toFixed(1)}%`, padLeft, height - 4);
        } else {
            this._drawAxisLabel(cr, `High: ${Formatter.formatCurrency(maxVal, this._currency)}`, padLeft, 12);
            this._drawAxisLabel(cr, `Low: ${Formatter.formatCurrency(minVal, this._currency)}`, width - padRight - 90, height - 4);
        }
    }

    _drawPlaceholder(cr, width, height) {
        cr.setSourceRGBA(0.4, 0.4, 0.4, 0.2);
        cr.setLineWidth(1);
        cr.rectangle(10, 10, width - 20, height - 20);
        cr.stroke();

        cr.setSourceRGBA(0.6, 0.6, 0.65, 0.6);
        cr.setFontSize(10);
        cr.moveTo(width / 2 - 36, height / 2);
        cr.showText('No chart data');
        cr.newPath();
    }

    _drawGrid(cr, x0, y0, x1, chartH) {
        cr.setSourceRGBA(0.3, 0.3, 0.35, 0.2);
        cr.setLineWidth(1);
        for (let i = 0; i <= 2; i++) {
            const y = y0 + (chartH / 2) * i;
            cr.moveTo(x0, y);
            cr.lineTo(x1, y);
            cr.stroke();
        }
    }

    _drawComparisonLegend(cr, drawable, padLeft, height) {
        const palette = this._palette();
        let x = padLeft;
        const y = height - 6;

        cr.setFontSize(9);
        drawable.forEach((series, index) => {
            const color = palette[index % palette.length];
            cr.setSourceRGBA(color[0], color[1], color[2], 1.0);
            cr.rectangle(x, y - 6, 6, 6);
            cr.fill();

            cr.moveTo(x + 9, y);
            cr.showText(series.label || '');
            cr.newPath();

            x += 9 + (series.label || '').length * 5.5 + 10;
        });
    }

    _drawAxisLabel(cr, text, x, y) {
        cr.setSourceRGBA(0.8, 0.8, 0.85, 0.8);
        cr.setFontSize(10);
        cr.moveTo(x, y);
        cr.showText(text);
        cr.newPath();
    }
});
