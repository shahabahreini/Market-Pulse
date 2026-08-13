/* Market Pulse — detached desktop widget
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ChartCanvas } from './chart.js';
import { Formatter } from '../helpers/formatter.js';

const WIDGET_WIDTH = 340;

const SCREEN_MARGIN = 40;

export const WidgetWindow = GObject.registerClass(
class WidgetWindow extends St.BoxLayout {
    _init(settingsHelper, providerRegistry) {
        super._init({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'market-pulse-widget-window',
            width: WIDGET_WIDTH,
            reactive: true,
            track_hover: true,
            can_focus: true
        });

        this._settings = settingsHelper;
        this._registry = providerRegistry;
        this._symbol = null;
        this._quote = null;
        this._dragStart = null;
        const header = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'market-pulse-widget-header'
        });
        this._titleLabel = new St.Label({
            text: 'Market Pulse',
            style_class: 'market-pulse-widget-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        // The widget is a fixed width; an un-ellipsized title would push the
        // close button past the right edge, out of the allocation.
        this._titleLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._header = header;
        header.add_child(this._titleLabel);

        this._closeBtn = new St.Button({
            child: new St.Icon({ icon_name: 'window-close-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            accessible_name: 'Close desktop widget'
        });
        this._closeBtn.connect('clicked', () => this._requestClose());
        header.add_child(this._closeBtn);
        this.add_child(header);

        this._priceLabel = new St.Label({ text: '—', style_class: 'market-pulse-widget-price' });
        this.add_child(this._priceLabel);

        this._chart = new ChartCanvas(WIDGET_WIDTH - 24, 140, settingsHelper.get('colorblind-mode'));
        this.add_child(this._chart);

        this._setupDragging();
    }

    setCloseHandler(handler) {
        this._onClose = handler;
    }

    _requestClose() {
        const handler = this._onClose;
        handler?.();
    }

    /** True when `actor` is the close button or lives inside it. */
    _isInCloseButton(actor) {
        for (let a = actor; a; a = a.get_parent()) {
            if (a === this._closeBtn) return true;
            if (a === this) return false;
        }
        return false;
    }

    /**
     * Click-and-drag repositioning.
     *
     * The drag holds a stage grab for its whole duration. Without one, a
     * release delivered outside the widget — easy, since the widget trails the
     * pointer by a frame — never reaches this actor, leaving _dragStart set so
     * the widget follows the cursor forever and its close button can never be
     * clicked.
     */
    _setupDragging() {
        this.connect('button-press-event', (actor, event) => {
            if (event.get_button() !== Clutter.BUTTON_PRIMARY) return Clutter.EVENT_PROPAGATE;
            // Never begin a drag on the close button's own press.
            if (this._isInCloseButton(event.get_source())) return Clutter.EVENT_PROPAGATE;

            const [x, y] = event.get_coords();
            this._dragStart = { x, y, actorX: this.x, actorY: this.y };
            this._grab = global.stage.grab(this);
            return Clutter.EVENT_STOP;
        });

        this.connect('motion-event', (actor, event) => {
            if (!this._dragStart) return Clutter.EVENT_PROPAGATE;
            const [x, y] = event.get_coords();
            this.set_position(
                Math.round(this._dragStart.actorX + (x - this._dragStart.x)),
                Math.round(this._dragStart.actorY + (y - this._dragStart.y))
            );
            return Clutter.EVENT_STOP;
        });

        this.connect('button-release-event', () => {
            if (!this._dragStart) return Clutter.EVENT_PROPAGATE;
            this._endDrag();
            this._savePosition();
            return Clutter.EVENT_STOP;
        });

        // Escape always closes, independently of pointer event routing.
        this.connect('key-press-event', (actor, event) => {
            if (event.get_key_symbol() !== Clutter.KEY_Escape) return Clutter.EVENT_PROPAGATE;
            this._requestClose();
            return Clutter.EVENT_STOP;
        });
    }

    _endDrag() {
        this._dragStart = null;
        if (this._grab) {
            this._grab.dismiss();
            this._grab = null;
        }
    }

    _savePosition() {
        try {
            this._settings.setString('widget-position', JSON.stringify({ x: this.x, y: this.y }));
        } catch (e) {
            console.warn(`[market-pulse] Could not save widget position: ${e.message}`);
        }
    }

    /**
     * Last saved position, clamped so a widget saved on a monitor that is no
     * longer attached cannot land off-screen.
     */
    _restoredPosition(workArea) {
        try {
            const raw = this._settings.get('widget-position');
            if (!raw) return null;
            const { x, y } = JSON.parse(raw);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return [
                Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - WIDGET_WIDTH),
                Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - 80)
            ];
        } catch (e) {
            return null;
        }
    }

    show(symbolObj, quote) {
        this._symbol = symbolObj;
        this.updateQuote(quote);

        if (!this._addedToChrome) {
            Main.layoutManager.addChrome(this, { trackFullscreen: true });
            this._addedToChrome = true;

            const workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
            const restored = this._restoredPosition(workArea);
            if (restored) {
                this.set_position(restored[0], restored[1]);
            } else {
                this.set_position(
                    workArea.x + workArea.width - WIDGET_WIDTH - SCREEN_MARGIN,
                    workArea.y + SCREEN_MARGIN
                );
            }
        }

        this.visible = true;
        this.grab_key_focus();   // so Escape reaches the handler
        this._loadChart();
    }

    updateQuote(quote) {
        this._quote = quote;
        if (!this._symbol) return;

        this._titleLabel.set_text(`${this._symbol.displayLabel} (${this._symbol.symbol})`);

        if (this._settings.get('hide-private-values')) {
            this._priceLabel.set_text('••••••');
            return;
        }

        this._priceLabel.set_text(quote
            ? `${Formatter.formatCurrency(quote.price, quote.currency)}  ${Formatter.formatPercent(quote.changePercent)}`
            : 'Waiting for quote…');
    }

    async _loadChart() {
        if (!this._symbol) return;
        const provider = this._registry.getProvider(this._symbol.provider || 'yahoo')
            || this._registry.getProvider('yahoo');
        if (!provider?.fetchChartData) return;

        try {
            const points = await provider.fetchChartData(this._symbol.symbol, '1d', '5m');
            if (this._chart) this._chart.setData(points, this._quote?.currency || 'USD');
        } catch (e) {
            console.warn(`[market-pulse] Widget chart error: ${e.message}`);
        }
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        this._endDrag();
        if (this._addedToChrome) {
            Main.layoutManager.removeChrome(this);
            this._addedToChrome = false;
        }
        this._onClose = null;
        this._symbol = null;
        this._quote = null;
        this._chart = null;
        super.destroy();
    }
});
