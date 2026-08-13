/* Market Pulse — menu row sparkline
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Zen & Modern aesthetic with organic tones, rounded geometry, and soft gradients
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Cairo from 'cairo';

export const Sparkline = GObject.registerClass(
class Sparkline extends St.DrawingArea {
    _init(width = 60, height = 24, isColorblind = false) {
        super._init({
            width: width,
            height: height,
            style_class: 'market-pulse-sparkline',
            x_expand: false,
            y_expand: false
        });

        this._points = [];
        this._isUp = true;
        this._isColorblind = isColorblind;

        this.connect('repaint', this._onRepaint.bind(this));
    }

    setPoints(points, isUp = true) {
        this._points = Array.isArray(points) ? points : [];
        this._isUp = isUp;
        if (this.is_visible()) {
            this.queue_repaint();
        }
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

        if (this._points.length < 2) return;

        const min = Math.min(...this._points);
        const max = Math.max(...this._points);
        const range = max - min || 1;
        const padding = 3;

        const stepX = (width - padding * 2) / (this._points.length - 1);

        cr.setLineJoin(1); // CAIRO_LINE_JOIN_ROUND
        cr.setLineCap(1);  // CAIRO_LINE_CAP_ROUND

        cr.newPath();
        for (let i = 0; i < this._points.length; i++) {
            const x = padding + i * stepX;
            const y = height - padding - ((this._points[i] - min) / range) * (height - padding * 2);

            if (i === 0) cr.moveTo(x, y);
            else cr.lineTo(x, y);
        }

        // Zen color selection
        let color;
        if (this._isUp) {
            color = this._isColorblind ? [0.38, 0.64, 0.88] : [0.38, 0.72, 0.56];
        } else {
            color = this._isColorblind ? [0.88, 0.62, 0.35] : [0.88, 0.48, 0.48];
        }

        cr.setSourceRGBA(color[0], color[1], color[2], 0.95);
        cr.setLineWidth(1.6);
        cr.strokePreserve();

        // Area fill beneath sparkline with gentle vertical gradient
        cr.lineTo(width - padding, height);
        cr.lineTo(padding, height);
        cr.closePath();

        if (Cairo?.LinearGradient) {
            try {
                const pat = new Cairo.LinearGradient(0, padding, 0, height);
                pat.addColorStopRGBA(0, color[0], color[1], color[2], 0.22);
                pat.addColorStopRGBA(1, color[0], color[1], color[2], 0.02);
                cr.setSource(pat);
            } catch {
                cr.setSourceRGBA(color[0], color[1], color[2], 0.12);
            }
        } else {
            cr.setSourceRGBA(color[0], color[1], color[2], 0.12);
        }
        cr.fill();
    }
});
