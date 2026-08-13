/* Market Pulse — panel indicator
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Zen & Modern aesthetic with gentle text transition and clean layout
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Formatter } from '../helpers/formatter.js';
import { symbolicGIcon } from '../helpers/icons.js';

export const PanelTicker = GObject.registerClass(
class PanelTicker extends PanelMenu.Button {
    _init(settingsHelper, pollingScheduler, extensionPath) {
        super._init(0.5, 'Market Pulse', false);

        this._settingsHelper = settingsHelper;
        this._scheduler = pollingScheduler;
        this._currentIndex = 0;
        this._quotesMap = {};
        this._timerId = null;
        this._isHovered = false;

        this._box = new St.BoxLayout({
            style_class: 'panel-status-menu-box market-pulse-ticker-box'
        });

        this._icon = new St.Icon({
            gicon: symbolicGIcon(extensionPath),
            style_class: 'system-status-icon market-pulse-panel-icon'
        });
        this._box.add_child(this._icon);

        this._label = new St.Label({
            text: 'Market Pulse',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'market-pulse-panel-label'
        });
        // Without this a long instrument name stretches the panel indefinitely
        this._label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._box.add_child(this._label);

        this._pinIcon = new St.Icon({
            icon_name: 'view-pin-symbolic',
            style_class: 'system-status-icon market-pulse-pin-icon'
        });
        this._pinIcon.hide();
        this._box.add_child(this._pinIcon);

        this.add_child(this._box);

        this.connect('enter-event', () => {
            if (this._settingsHelper.get('ticker-pause-on-hover')) {
                this._isHovered = true;
            }
        });

        this.connect('leave-event', () => {
            this._isHovered = false;
        });

        this.connect('button-press-event', (actor, event) => {
            const button = event.get_button();
            if (button === 2) { // Middle click -> Manual Refresh
                this._scheduler.triggerRefresh();
                return Clutter.EVENT_STOP;
            }
            if (button === 3) { // Right click -> Toggle Pin active symbol
                this._togglePinCurrentSymbol();
                return Clutter.EVENT_STOP;
            }
            if (button === 1) { // Left click -> Advance to next symbol
                this.advanceSymbol();
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.startTickerTimer();
    }

    updateQuotes(quotesMap) {
        this._quotesMap = quotesMap;
        this.refreshDisplay();
    }

    /** A different portfolio means the current index no longer points at it. */
    onPortfolioChanged() {
        this._currentIndex = 0;
        this._quotesMap = {};
        this.refreshDisplay();
    }

    startTickerTimer() {
        this.stopTickerTimer();
        const interval = Math.max(2, this._settingsHelper.get('ticker-interval') || 5);

        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            // Schema default is true, so an unreadable key must not freeze cycling.
            const cycling = this._settingsHelper.get('ticker-cycling-enabled') ?? true;
            if (cycling && !this._isHovered) {
                this.advanceSymbol();
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    stopTickerTimer() {
        if (this._timerId) {
            GLib.Source.remove(this._timerId);
            this._timerId = null;
        }
    }

    advanceSymbol() {
        const portfolio = this._settingsHelper.getActivePortfolio();
        const symbols = portfolio.symbols;
        if (symbols.length === 0) return;

        this._currentIndex = (this._currentIndex + 1) % symbols.length;
        this.refreshDisplay();
    }

    _togglePinCurrentSymbol() {
        const portfolio = this._settingsHelper.getActivePortfolio();
        if (portfolio.symbols.length === 0) return;
        const currentSym = portfolio.symbols[this._currentIndex]?.symbol || '';
        const pinned = this._settingsHelper.get('pinned-symbol');

        this._settingsHelper.setString('pinned-symbol', pinned === currentSym ? '' : currentSym);
        this.refreshDisplay();
    }

    refreshDisplay() {
        const portfolio = this._settingsHelper.getActivePortfolio();
        const symbols = portfolio.symbols;
        if (symbols.length === 0) {
            this._setLabelTextAnimated('Market Pulse');
            this._pinIcon.hide();
            return;
        }

        const pinned = this._settingsHelper.get('pinned-symbol');
        let targetSymObj = null;

        if (pinned && symbols.some(s => s.symbol === pinned)) {
            targetSymObj = symbols.find(s => s.symbol === pinned);
        } else {
            if (this._currentIndex >= symbols.length) this._currentIndex = 0;
            targetSymObj = symbols[this._currentIndex];
        }

        if (!targetSymObj) return;
        const quote = this._quotesMap[targetSymObj.symbol];
        // Per-symbol override wins over the global format.
        const displayMode = this._settingsHelper.getDisplayModeForSymbol(targetSymObj.symbol);
        const isMasked = this._settingsHelper.get('hide-private-values');

        let text = `${targetSymObj.displayLabel}: `;

        if (!quote) {
            text += '...';
        } else if (isMasked) {
            text += '••••••';
        } else {
            const priceStr = Formatter.formatCurrency(quote.price, quote.currency);
            const pctStr = Formatter.formatPercent(quote.changePercent);
            const absStr = Formatter.formatChangeAbs(quote.change, quote.currency);

            if (displayMode === 'price') text += priceStr;
            else if (displayMode === 'change-pct') text += pctStr;
            else if (displayMode === 'change-abs') text += absStr;
            else text += `${priceStr} (${pctStr})`;
        }

        this._setLabelTextAnimated(text);
        if (pinned === targetSymObj.symbol) this._pinIcon.show();
        else this._pinIcon.hide();
    }

    /** Gentle calm cross-fade when text changes. */
    _setLabelTextAnimated(text) {
        if (this._label.text === text) return;

        if (this.is_mapped() && this._label.is_visible()) {
            this._label.remove_all_transitions();
            this._label.ease({
                opacity: 60,
                duration: 90,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    this._label.set_text(text);
                    this._label.ease({
                        opacity: 255,
                        duration: 130,
                        mode: Clutter.AnimationMode.EASE_OUT_QUAD
                    });
                }
            });
        } else {
            this._label.set_text(text);
            this._label.opacity = 255;
        }
    }

    destroy() {
        this.stopTickerTimer();
        this._label.remove_all_transitions();
        super.destroy();
    }
});
