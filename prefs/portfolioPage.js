/**
 * Market Pulse — Preferences Portfolio Page
 * GPL-3.0 License
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

export const PortfolioPage = GObject.registerClass(
class PortfolioPage extends Adw.PreferencesPage {
    _init(settingsHelper) {
        super._init({
            title: 'Portfolios',
            icon_name: 'folder-saved-symbolic'
        });

        this._settingsHelper = settingsHelper;

        const group = new Adw.PreferencesGroup({
            title: 'Symbol Holdings & Privacy',
            description: 'Manage cost basis, quantities, and privacy settings'
        });

        // Privacy Toggle Row
        const maskRow = new Adw.SwitchRow({
            title: 'Mask Portfolio Values',
            subtitle: 'Hide total holdings and P&L amounts for screen sharing',
            active: this._settingsHelper.get('hide-private-values')
        });
        maskRow.connect('notify::active', () => {
            this._settingsHelper.set('hide-private-values', new GObject.Value(maskRow.get_active()));
        });
        group.add(maskRow);

        // Colorblind Mode Row
        const cbRow = new Adw.SwitchRow({
            title: 'Colorblind Safe Mode',
            subtitle: 'Use blue and orange colors for market gain/loss indicators',
            active: this._settingsHelper.get('colorblind-mode')
        });
        cbRow.connect('notify::active', () => {
            this._settingsHelper.set('colorblind-mode', new GObject.Value(cbRow.get_active()));
        });
        group.add(cbRow);

        this.add(group);
    }
});
