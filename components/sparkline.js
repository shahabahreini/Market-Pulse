/**
 * Market Pulse — Cairo Sparkline Component
 * GPL-3.0 License
 */

import St from 'gi://St';
import GObject from 'gi://GObject';

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

        if (this._points.length < 2) return;

        const min = Math.min(...this._points);
        const max = Math.max(...this._points);
        const range = max - min || 1;
        const padding = 2;

        const stepX = (width - padding * 2) / (this._points.length - 1);

        cr.newPath();
        for (let i = 0; i < this._points.length; i++) {
            const x = padding + i * stepX;
            const y = height - padding - ((this._points[i] - min) / range) * (height - padding * 2);

            if (i === 0) cr.moveTo(x, y);
            else cr.lineTo(x, y);
        }

        // Color selection
        if (this._isUp) {
            if (this._isColorblind) cr.setSourceRGBA(0.22, 0.58, 0.96, 0.9); // Blue
            else cr.setSourceRGBA(0.2, 0.83, 0.6, 0.9); // Mint/Green
        } else {
            if (this._isColorblind) cr.setSourceRGBA(0.96, 0.55, 0.18, 0.9); // Orange
            else cr.setSourceRGBA(0.96, 0.42, 0.42, 0.9); // Soft Red
        }

        cr.setLineWidth(1.5);
        cr.strokePreserve();

        // Area fill beneath sparkline
        cr.lineTo(width - padding, height);
        cr.lineTo(padding, height);
        cr.closePath();

        if (this._isUp) {
            cr.setSourceRGBA(0.2, 0.83, 0.6, 0.15);
        } else {
            cr.setSourceRGBA(0.96, 0.42, 0.42, 0.15);
        }
        cr.fill();
    }
});
