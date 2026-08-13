/**
 * Market Pulse — GNOME Quick Settings Integration
 * GPL-3.0 License
 */

import GObject from 'gi://GObject';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const QuickSettingsToggle = GObject.registerClass(
class QuickSettingsToggle extends QuickSettings.Toggle {
    _init(pollingScheduler) {
        super._init({
            title: 'Market Pulse',
            subtitle: 'Live Polling',
            iconName: 'market-pulse-symbolic',
            toggleMode: true
        });

        this._scheduler = pollingScheduler;
        this.checked = true;

        this.connect('clicked', () => {
            this.checked = !this.checked;
            if (this.checked) {
                this.subtitle = 'Live Polling';
                this._scheduler.resume();
            } else {
                this.subtitle = 'Paused';
                this._scheduler.pause();
            }
        });
    }
});

export class QuickSettingsIndicator extends QuickSettings.SystemIndicator {
    _init(pollingScheduler) {
        super._init();

        this._toggle = new QuickSettingsToggle(pollingScheduler);
        this.quickSettingsItems.push(this._toggle);

        Main.panel.statusArea.quickSettings.addExternalIndicator(this);
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
}
