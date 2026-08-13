/* Market Pulse — Quick Settings toggle
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import GObject from 'gi://GObject';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const MarketPulseToggle = GObject.registerClass(
class MarketPulseToggle extends QuickSettings.QuickToggle {
    _init(pollingScheduler) {
        super._init({
            title: 'Market Pulse',
            subtitle: 'Live Polling',
            iconName: 'market-pulse-symbolic',
            toggleMode: true
        });

        this._scheduler = pollingScheduler;
        this.checked = true;

        // toggleMode already flips `checked` — only react to the result.
        this._notifyId = this.connect('notify::checked', () => {
            if (this.checked) {
                this.subtitle = 'Live Polling';
                this._scheduler.resume();
            } else {
                this.subtitle = 'Paused';
                this._scheduler.pause();
            }
        });
    }

    destroy() {
        if (this._notifyId) {
            this.disconnect(this._notifyId);
            this._notifyId = null;
        }
        this._scheduler = null;
        super.destroy();
    }
});

/**
 * Composes a SystemIndicator rather than subclassing it — subclassing a
 * GObject type from plain JS (no registerClass) throws on instantiation.
 */
export class QuickSettingsIndicator {
    constructor(pollingScheduler) {
        this._indicator = new QuickSettings.SystemIndicator();
        this._toggle = new MarketPulseToggle(pollingScheduler);
        this._indicator.quickSettingsItems.push(this._toggle);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    destroy() {
        if (this._indicator) {
            for (const item of this._indicator.quickSettingsItems) {
                item.destroy();
            }
            this._indicator.quickSettingsItems = [];
            this._indicator.destroy();
            this._indicator = null;
        }
        this._toggle = null;
    }
}
