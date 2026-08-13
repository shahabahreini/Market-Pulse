/**
 * Market Pulse — Main Interactive Cairo Chart Component
 * GPL-3.0 License
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import { Formatter } from '../helpers/formatter.js';

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

        this._data = [];
        this._currency = 'USD';
        this._isColorblind = isColorblind;
        this.connect('repaint', this._onRepaint.bind(this));
    }

    setData(points, currency = 'USD') {
        this._data = Array.isArray(points) ? points : [];
        this._currency = currency;
        if (this.is_visible()) {
            this.queue_repaint();
        }
    }

    _onRepaint(area) {
        if (!area.is_visible()) return;

        const cr = area.get_context();
        const [width, height] = area.get_surface_size();

        cr.save();
        cr.setOperator(0); // CLEAR
        cr.paint();
        cr.restore();

        if (this._data.length < 2) {
            cr.setSourceRGBA(0.4, 0.4, 0.4, 0.2);
            cr.setLineWidth(1);
            cr.rectangle(10, 10, width - 20, height - 20);
            cr.stroke();
            return;
        }

        const prices = this._data.map(p => p.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const range = maxPrice - minPrice || 1;

        const padLeft = 10;
        const padRight = 10;
        const padTop = 20;
        const padBottom = 20;

        const chartW = width - padLeft - padRight;
        const chartH = height - padTop - padBottom;

        const isUp = prices[prices.length - 1] >= prices[0];

        // Draw horizontal grid lines (3 lines)
        cr.setSourceRGBA(0.3, 0.3, 0.35, 0.2);
        cr.setLineWidth(1);
        for (let i = 0; i <= 2; i++) {
            const y = padTop + (chartH / 2) * i;
            cr.moveTo(padLeft, y);
            cr.lineTo(width - padRight, y);
            cr.stroke();
        }

        // Draw price curve
        const stepX = chartW / (this._data.length - 1);
        cr.newPath();
        for (let i = 0; i < this._data.length; i++) {
            const x = padLeft + i * stepX;
            const y = padTop + chartH - ((prices[i] - minPrice) / range) * chartH;

            if (i === 0) cr.moveTo(x, y);
            else cr.lineTo(x, y);
        }

        if (isUp) {
            if (this._isColorblind) cr.setSourceRGBA(0.22, 0.58, 0.96, 1.0);
            else cr.setSourceRGBA(0.2, 0.83, 0.6, 1.0);
        } else {
            if (this._isColorblind) cr.setSourceRGBA(0.96, 0.55, 0.18, 1.0);
            else cr.setSourceRGBA(0.96, 0.42, 0.42, 1.0);
        }

        cr.setLineWidth(2.0);
        cr.strokePreserve();

        // Area fill
        cr.lineTo(width - padRight, height - padBottom);
        cr.lineTo(padLeft, height - padBottom);
        cr.closePath();

        if (isUp) {
            cr.setSourceRGBA(0.2, 0.83, 0.6, 0.12);
        } else {
            cr.setSourceRGBA(0.96, 0.42, 0.42, 0.12);
        }
        cr.fill();

        // High & Low Callouts
        cr.setSourceRGBA(0.8, 0.8, 0.85, 0.8);
        cr.setFontSize(10);
        cr.moveTo(padLeft, 12);
        cr.showText(`High: ${Formatter.formatCurrency(maxPrice, this._currency)}`);
        cr.stroke();

        cr.moveTo(width - padRight - 80, height - 4);
        cr.showText(`Low: ${Formatter.formatCurrency(minPrice, this._currency)}`);
        cr.stroke();
    }
});
