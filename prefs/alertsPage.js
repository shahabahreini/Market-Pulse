/**
 * Market Pulse — Preferences Alerts Page
 * GPL-3.0 License
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

export const AlertsPage = GObject.registerClass(
class AlertsPage extends Adw.PreferencesPage {
    _init(settingsHelper) {
        super._init({
            title: 'Alerts',
            icon_name: 'preferences-system-notifications-symbolic'
        });

        this._settingsHelper = settingsHelper;
        const group = new Adw.PreferencesGroup({
            title: 'Session-Bound Price Alerts',
            description: 'Notifications fire only while GNOME extension is active. No background daemons or audio.'
        });

        const alertSwitch = new Adw.SwitchRow({
            title: 'Enable Price Notifications',
            subtitle: 'Notify on target prices and daily surge/decline thresholds',
            active: this._settingsHelper.get('alerts-enabled')
        });
        alertSwitch.connect('notify::active', () => {
            this._settingsHelper.set('alerts-enabled', new GObject.Value(alertSwitch.get_active()));
        });
        group.add(alertSwitch);

        const quietSwitch = new Adw.SwitchRow({
            title: 'Enable Quiet Hours',
            subtitle: 'Suppress alert notifications between 22:00 and 07:00',
            active: this._settingsHelper.get('quiet-hours-enabled')
        });
        quietSwitch.connect('notify::active', () => {
            this._settingsHelper.set('quiet-hours-enabled', new GObject.Value(quietSwitch.get_active()));
        });
        group.add(quietSwitch);

        this.add(group);
    }
});
