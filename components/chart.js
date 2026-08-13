/* Market Pulse — chart drawing area
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Zen & Modern aesthetic with organic tones, rounded geometry, and soft gradients
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Cairo from 'cairo';
import { Formatter } from '../helpers/formatter.js';

// Zen calming, organic palette
const SERIES_COLORS = [
    [0.38, 0.72, 0.56], // Zen Sage / Eucalyptus
    [0.40, 0.65, 0.85], // Ocean Slate Blue
    [0.88, 0.64, 0.38], // Warm Amber
    [0.72, 0.58, 0.85]  // Muted Lavender
];

const SERIES_COLORS_CB = [
    [0.38, 0.64, 0.88], // Slate Blue
    [0.88, 0.62, 0.35], // Warm Amber
    [0.60, 0.65, 0.70]  // Muted Stone
];

const DOWN_COLOR = [0.88, 0.48, 0.48];     // Soft Warm Terracotta / Rose
const DOWN_COLOR_CB = [0.88, 0.62, 0.35];  // Calming Amber

const ANIMATION_MS = 320; // Serene, smooth duration

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
            .slice(0, 4);
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

        // Driven by the actor's frame clock, stopping cleanly with the actor
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
        if (!area.is_visible()) return;

        const cr = area.get_context();
        try {
            this._draw(cr, area);
        } finally {
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

        const padLeft = 12;
        const padRight = 12;
        const padTop = 20;
        const padBottom = 22;
        const chartW = width - padLeft - padRight;
        const chartH = height - padTop - padBottom;

        const valuesFor = (series) => this._comparisonMode
            ? series.points.map(p => ((p.price - series.points[0].price) / series.points[0].price) * 100)
            : series.points.map(p => p.price);

        const allValues = drawable.flatMap(valuesFor);
        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);
        const range = maxVal - minVal || 1;

        this._drawGrid(cr, padLeft, padTop, width - padRight, chartH);

        const palette = this._palette();

        // Enable rounded stroke rendering for organic Zen lines
        cr.setLineJoin(1); // CAIRO_LINE_JOIN_ROUND
        cr.setLineCap(1);  // CAIRO_LINE_CAP_ROUND

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

            cr.setSourceRGBA(color[0], color[1], color[2], 0.95);
            cr.setLineWidth(this._comparisonMode ? 1.6 : 2.0);
            cr.strokePreserve();

            // Soft vertical gradient fill for single series
            if (!this._comparisonMode) {
                const lastX = padLeft + (visibleCount - 1) * stepX;
                cr.lineTo(lastX, height - padBottom);
                cr.lineTo(padLeft, height - padBottom);
                cr.closePath();

                if (Cairo?.LinearGradient) {
                    try {
                        const pat = new Cairo.LinearGradient(0, padTop, 0, height - padBottom);
                        pat.addColorStopRGBA(0, color[0], color[1], color[2], 0.20);
                        pat.addColorStopRGBA(1, color[0], color[1], color[2], 0.01);
                        cr.setSource(pat);
                    } catch {
                        cr.setSourceRGBA(color[0], color[1], color[2], 0.10);
                    }
                } else {
                    cr.setSourceRGBA(color[0], color[1], color[2], 0.10);
                }
                cr.fill();
            } else {
                cr.newPath();
            }
        });

        if (this._comparisonMode) {
            this._drawComparisonLegend(cr, drawable, padLeft, height);
            this._drawAxisLabel(cr, `${maxVal >= 0 ? '+' : ''}${maxVal.toFixed(1)}%`, padLeft, 13);
            this._drawAxisLabel(cr, `${minVal >= 0 ? '+' : ''}${minVal.toFixed(1)}%`, padLeft, height - 5);
        } else {
            this._drawAxisLabel(cr, `High: ${Formatter.formatCurrency(maxVal, this._currency)}`, padLeft, 13);
            this._drawAxisLabel(cr, `Low: ${Formatter.formatCurrency(minVal, this._currency)}`, width - padRight - 90, height - 5);
        }
    }

    _drawPlaceholder(cr, width, height) {
        cr.setSourceRGBA(0.4, 0.4, 0.45, 0.15);
        cr.setLineWidth(1);
        cr.setLineJoin(1);
        cr.setLineCap(1);
        cr.rectangle(12, 12, width - 24, height - 24);
        cr.stroke();

        cr.setSourceRGBA(0.7, 0.7, 0.75, 0.5);
        cr.setFontSize(10);
        cr.moveTo(width / 2 - 36, height / 2);
        cr.showText('No chart data');
        cr.newPath();
    }

    _drawGrid(cr, x0, y0, x1, chartH) {
        cr.setSourceRGBA(0.8, 0.8, 0.85, 0.06);
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
            cr.setSourceRGBA(color[0], color[1], color[2], 0.95);
            cr.rectangle(x, y - 6, 6, 6);
            cr.fill();

            cr.moveTo(x + 9, y);
            cr.showText(series.label || '');
            cr.newPath();

            x += 9 + (series.label || '').length * 5.5 + 10;
        });
    }

    _drawAxisLabel(cr, text, x, y) {
        cr.setSourceRGBA(0.8, 0.8, 0.85, 0.75);
        cr.setFontSize(10);
        cr.moveTo(x, y);
        cr.showText(text);
        cr.newPath();
    }
});
