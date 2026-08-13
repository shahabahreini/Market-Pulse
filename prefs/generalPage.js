/**
 * Market Pulse — Preferences General Page
 * GPL-3.0 License
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

export const GeneralPage = GObject.registerClass(
class GeneralPage extends Adw.PreferencesPage {
    _init(settingsHelper) {
        super._init({
            title: 'General',
            icon_name: 'preferences-system-symbolic'
        });

        this._settingsHelper = settingsHelper;
        this._settings = settingsHelper.getSettings();

        // --- Group 1: Top Panel Ticker & Placement ---
        const panelGroup = new Adw.PreferencesGroup({ title: 'Top Panel Ticker & Placement' });

        // Panel Placement ComboRow
        const posRow = new Adw.ComboRow({
            title: 'Top Panel Position',
            subtitle: 'Location of Market Pulse indicator in GNOME top bar',
            model: new Gtk.StringList({
                strings: ['Right', 'Center', 'Left']
            })
        });
        const posEnum = this._settings.get_enum('panel-position');
        posRow.set_selected(posEnum);
        posRow.connect('notify::selected', () => {
            this._settings.set_enum('panel-position', posRow.get_selected());
        });
        panelGroup.add(posRow);

        // Ticker Display Mode
        const modeRow = new Adw.ComboRow({
            title: 'Ticker Display Format',
            subtitle: 'Choose information rendered in top bar ticker',
            model: new Gtk.StringList({
                strings: ['Price + Change %', 'Price Only', 'Change % Only', 'Change (Abs) Only']
            })
        });
        const modeEnum = this._settings.get_enum('ticker-mode');
        modeRow.set_selected(modeEnum);
        modeRow.connect('notify::selected', () => {
            this._settings.set_enum('ticker-mode', modeRow.get_selected());
        });
        panelGroup.add(modeRow);

        // Ticker Interval SpinRow
        const intervalRow = new Adw.SpinRow({
            title: 'Ticker Rotation Interval (seconds)',
            subtitle: 'Time between automatic symbol rotations',
            adjustment: new Gtk.Adjustment({
                lower: 2,
                upper: 60,
                step_increment: 1,
                value: this._settings.get_int('ticker-interval')
            })
        });
        intervalRow.connect('notify::value', () => {
            this._settings.set_int('ticker-interval', intervalRow.get_value());
        });
        panelGroup.add(intervalRow);

        // Cycling Switch
        const cycleRow = new Adw.SwitchRow({
            title: 'Automatic Ticker Rotation',
            subtitle: 'Cycle through portfolio symbols automatically',
            active: this._settings.get_boolean('ticker-cycling-enabled')
        });
        cycleRow.connect('notify::active', () => {
            this._settings.set_boolean('ticker-cycling-enabled', cycleRow.get_active());
        });
        panelGroup.add(cycleRow);

        // Pause on Hover Switch
        const hoverRow = new Adw.SwitchRow({
            title: 'Pause Ticker on Mouse Hover',
            subtitle: 'Pause rotation when hovering over panel indicator',
            active: this._settings.get_boolean('ticker-pause-on-hover')
        });
        hoverRow.connect('notify::active', () => {
            this._settings.set_boolean('ticker-pause-on-hover', hoverRow.get_active());
        });
        panelGroup.add(hoverRow);

        // Quick Settings Menu Toggle
        const qsRow = new Adw.SwitchRow({
            title: 'Quick Settings Integration',
            subtitle: 'Show pause/resume polling toggle in GNOME Quick Settings menu',
            active: this._settings.get_boolean('quick-settings-integration')
        });
        qsRow.connect('notify::active', () => {
            this._settings.set_boolean('quick-settings-integration', qsRow.get_active());
        });
        panelGroup.add(qsRow);

        this.add(panelGroup);

        // --- Group 2: Polling & Battery ---
        const pollGroup = new Adw.PreferencesGroup({ title: 'Adaptive Market Polling' });

        const marketPollRow = new Adw.SpinRow({
            title: 'Market Hours Frequency (seconds)',
            subtitle: 'Polling rate during active trading hours (default 30s)',
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 300,
                step_increment: 5,
                value: this._settings.get_int('market-polling-interval')
            })
        });
        marketPollRow.connect('notify::value', () => {
            this._settings.set_int('market-polling-interval', marketPollRow.get_value());
        });
        pollGroup.add(marketPollRow);

        const offPollRow = new Adw.SpinRow({
            title: 'Off-Hours Frequency (seconds)',
            subtitle: 'Polling rate when markets are closed (default 900s / 15m)',
            adjustment: new Gtk.Adjustment({
                lower: 60,
                upper: 3600,
                step_increment: 60,
                value: this._settings.get_int('off-market-polling-interval')
            })
        });
        offPollRow.connect('notify::value', () => {
            this._settings.set_int('off-market-polling-interval', offPollRow.get_value());
        });
        pollGroup.add(offPollRow);

        const battRow = new Adw.SwitchRow({
            title: 'Pause Polling on Battery Power',
            subtitle: 'Conserve system power when laptop is unplugged',
            active: this._settings.get_boolean('pause-on-battery')
        });
        battRow.connect('notify::active', () => {
            this._settings.set_boolean('pause-on-battery', battRow.get_active());
        });
        pollGroup.add(battRow);

        this.add(pollGroup);

        // --- Group 3: Desktop Integration ---
        const integrationGroup = new Adw.PreferencesGroup({
            title: 'Desktop Integration',
            description: 'How Market Pulse appears elsewhere in GNOME Shell'
        });

        const searchRow = new Adw.SwitchRow({
            title: 'Overview Search Results',
            subtitle: 'Show tracked symbols and their prices when searching the Activities overview',
            active: this._settings.get_boolean('search-provider-enabled')
        });
        searchRow.connect('notify::active', () => {
            this._settings.set_boolean('search-provider-enabled', searchRow.get_active());
        });
        integrationGroup.add(searchRow);

        const shortcutRow = new Adw.SwitchRow({
            title: 'Keyboard Shortcut',
            subtitle: 'Open the Market Pulse menu with Super+M',
            active: this._settings.get_boolean('menu-shortcut-enabled')
        });
        shortcutRow.connect('notify::active', () => {
            this._settings.set_boolean('menu-shortcut-enabled', shortcutRow.get_active());
        });
        integrationGroup.add(shortcutRow);

        const restartNote = new Adw.ActionRow({
            title: 'Changes to this section apply on next enable',
            subtitle: 'Toggle the extension off and on to register or remove these integrations'
        });
        integrationGroup.add(restartNote);

        this.add(integrationGroup);
    }
});
