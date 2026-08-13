/**
 * Market Pulse — Detached Desktop Widget (plan §C12)
 *
 * An always-on-top chart panel laid out in the Shell's chrome rather than a
 * real window: it needs no Gtk, survives workspace switches, and is torn down
 * completely on disable().
 *
 * GPL-3.0 License
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
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

        // Header with title and close affordance
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
        header.add_child(this._titleLabel);

        this._closeBtn = new St.Button({
            child: new St.Icon({ icon_name: 'window-close-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            accessible_name: 'Close desktop widget'
        });
        this._closeBtn.connect('clicked', () => this._onClose?.());
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

    /** Click-and-drag repositioning; the widget stays inside the work area. */
    _setupDragging() {
        this.connect('button-press-event', (actor, event) => {
            const [x, y] = event.get_coords();
            this._dragStart = { x, y, actorX: this.x, actorY: this.y };
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
            this._dragStart = null;
            return Clutter.EVENT_STOP;
        });
    }

    show(symbolObj, quote) {
        this._symbol = symbolObj;
        this.updateQuote(quote);

        if (!this._addedToChrome) {
            Main.layoutManager.addChrome(this, { trackFullscreen: true });
            this._addedToChrome = true;

            const workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
            this.set_position(
                workArea.x + workArea.width - WIDGET_WIDTH - SCREEN_MARGIN,
                workArea.y + SCREEN_MARGIN
            );
        }

        this.visible = true;
        this._loadChart();
    }

    updateQuote(quote) {
        this._quote = quote;
        if (!this._symbol) return;

        this._titleLabel.set_text(`${this._symbol.name} (${this._symbol.symbol})`);

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
