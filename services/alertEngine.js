/* Market Pulse — price alert evaluation
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import { Formatter } from '../helpers/formatter.js';

export class AlertEngine {
    constructor(settingsHelper, gicon = null) {
        this._settingsHelper = settingsHelper;
        this._gicon = gicon;
        this._triggeredSet = new Set();
        this._source = null;
    }

    _ensureNotificationSource() {
        if (!this._source) {
            this._source = new MessageTray.Source({
                title: 'Market Pulse',
                icon: this._gicon
            });
            Main.messageTray.add(this._source);
        }
    }

    checkQuotes(quotesMap) {
        if (!this._settingsHelper.get('alerts-enabled')) return;
        if (this._isQuietHours()) return;

        // Notification headlines use the user's label; bodies keep the raw
        // ticker so the symbol being alerted on is never ambiguous.
        const labels = new Map(
            this._settingsHelper.getActivePortfolio().symbols.map(s => [s.symbol, s.displayLabel])
        );

        const rules = this._settingsHelper.getAlertRules();
        for (const rule of rules) {
            if (!rule.enabled) continue;
            const quote = quotesMap[rule.symbol];
            if (!quote) continue;
            const label = labels.get(rule.symbol) || rule.symbol;

            const triggerKey = `${rule.id}_${Math.floor(Date.now() / (15 * 60 * 1000))}`; // Throttle 15m
            if (this._triggeredSet.has(triggerKey)) continue;

            let isTriggered = false;
            let title = '';
            let body = '';

            if (rule.condition === 'ABOVE_PRICE' && quote.price >= rule.threshold) {
                isTriggered = true;
                title = `${label} reached its target`;
                body = `${rule.symbol} reached ${Formatter.formatCurrency(quote.price, quote.currency)} (Above target ${Formatter.formatCurrency(rule.threshold, quote.currency)})`;
            } else if (rule.condition === 'BELOW_PRICE' && quote.price <= rule.threshold) {
                isTriggered = true;
                title = `${label} fell below its target`;
                body = `${rule.symbol} fell to ${Formatter.formatCurrency(quote.price, quote.currency)} (Below target ${Formatter.formatCurrency(rule.threshold, quote.currency)})`;
            } else if (rule.condition === 'GAIN_PCT' && quote.changePercent >= rule.threshold) {
                isTriggered = true;
                title = `${label} is up ${quote.changePercent.toFixed(2)}% today`;
                body = `${rule.symbol} is up ${Formatter.formatPercent(quote.changePercent)} today at ${Formatter.formatCurrency(quote.price, quote.currency)}`;
            } else if (rule.condition === 'LOSS_PCT' && quote.changePercent <= -Math.abs(rule.threshold)) {
                isTriggered = true;
                title = `${label} is down ${Math.abs(quote.changePercent).toFixed(2)}% today`;
                body = `${rule.symbol} dropped ${Formatter.formatPercent(quote.changePercent)} today at ${Formatter.formatCurrency(quote.price, quote.currency)}`;
            }

            if (isTriggered) {
                this._triggeredSet.add(triggerKey);
                this._notify(title, body);
            }
        }
    }

    _isQuietHours() {
        if (!this._settingsHelper.get('quiet-hours-enabled')) return false;

        const startStr = this._settingsHelper.get('quiet-hours-start') || '22:00';
        const endStr = this._settingsHelper.get('quiet-hours-end') || '07:00';

        const now = new Date();
        const curMins = now.getHours() * 60 + now.getMinutes();

        const [sH, sM] = startStr.split(':').map(Number);
        const [eH, eM] = endStr.split(':').map(Number);
        const startMins = sH * 60 + sM;
        const endMins = eH * 60 + eM;

        if (startMins < endMins) {
            return curMins >= startMins && curMins < endMins;
        } else {
            // Overnight span e.g. 22:00 to 07:00
            return curMins >= startMins || curMins < endMins;
        }
    }

    _notify(title, body) {
        try {
            this._ensureNotificationSource();
            const notification = new MessageTray.Notification({
                source: this._source,
                title: title,
                body: body,
                isTransient: true
            });
            this._source.addNotification(notification);
        } catch (e) {
            console.error(`[market-pulse] Notification error: ${e.message}`);
        }
    }

    destroy() {
        this._triggeredSet.clear();
        if (this._source) {
            this._source.destroy();
            this._source = null;
        }
    }
}
