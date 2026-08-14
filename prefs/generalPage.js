/* Market Pulse — preferences: general
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';

/** Named update speeds, so nobody has to reason in seconds to get started. */
const SPEED_PRESETS = [
    { label: 'Fast — every 15 seconds', market: 15, off: 300 },
    { label: 'Normal — every 30 seconds', market: 30, off: 900 },
    { label: 'Battery saver — every 2 minutes', market: 120, off: 3600 },
    { label: 'Custom', custom: true }
];
const CUSTOM_PRESET_INDEX = SPEED_PRESETS.length - 1;

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
        // Adw treats titles and subtitles as Pango markup — '&' must be escaped.
        const panelGroup = new Adw.PreferencesGroup({ title: 'Top Panel Ticker &amp; Placement' });

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

        const themeRow = new Adw.ComboRow({
            title: 'Appearance',
            subtitle: 'Use the GNOME appearance or choose a Market Pulse theme',
            model: new Gtk.StringList({
                strings: ['Follow System', 'Light', 'Dark']
            })
        });
        const themeModes = ['system', 'light', 'dark'];
        const themeMode = this._settings.get_string('theme-mode');
        themeRow.set_selected(Math.max(0, themeModes.indexOf(themeMode)));
        themeRow.connect('notify::selected', () => {
            this._settings.set_string('theme-mode', themeModes[themeRow.get_selected()]);
        });
        panelGroup.add(themeRow);

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
        const pollGroup = new Adw.PreferencesGroup({
            title: 'How Often Prices Update',
            description: 'Faster updates use more network and battery'
        });

        const speedRow = new Adw.ComboRow({
            title: 'Update Speed',
            model: new Gtk.StringList({
                strings: SPEED_PRESETS.map(p => p.label)
            })
        });
        pollGroup.add(speedRow);

        // The raw seconds stay available, one disclosure away.
        const advancedRow = new Adw.ExpanderRow({
            title: 'Advanced',
            subtitle: 'Set the exact polling intervals yourself'
        });

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
        advancedRow.add_row(marketPollRow);

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
        advancedRow.add_row(offPollRow);
        pollGroup.add(advancedRow);

        // The preset row and the spin rows are two views of the same two keys,
        // so each guards against reacting to the other's writes.
        let syncingSpeed = false;

        const matchPreset = () => {
            const market = this._settings.get_int('market-polling-interval');
            const off = this._settings.get_int('off-market-polling-interval');
            const index = SPEED_PRESETS.findIndex(p => p.market === market && p.off === off);
            return index >= 0 ? index : CUSTOM_PRESET_INDEX;
        };

        speedRow.set_selected(matchPreset());

        speedRow.connect('notify::selected', () => {
            const preset = SPEED_PRESETS[speedRow.get_selected()];
            if (syncingSpeed || !preset || preset.custom) return;

            syncingSpeed = true;
            this._settings.set_int('market-polling-interval', preset.market);
            this._settings.set_int('off-market-polling-interval', preset.off);
            marketPollRow.set_value(preset.market);
            offPollRow.set_value(preset.off);
            syncingSpeed = false;
        });

        marketPollRow.connect('notify::value', () => {
            this._settings.set_int('market-polling-interval', marketPollRow.get_value());
            if (!syncingSpeed) speedRow.set_selected(matchPreset());
        });
        offPollRow.connect('notify::value', () => {
            this._settings.set_int('off-market-polling-interval', offPollRow.get_value());
            if (!syncingSpeed) speedRow.set_selected(matchPreset());
        });

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
            subtitle: 'Open the Market Pulse menu with a key combination',
            active: this._settings.get_boolean('menu-shortcut-enabled')
        });
        shortcutRow.connect('notify::active', () => {
            this._settings.set_boolean('menu-shortcut-enabled', shortcutRow.get_active());
        });
        integrationGroup.add(shortcutRow);

        integrationGroup.add(this._buildShortcutRow());

        this.add(integrationGroup);
    }

    /** Click-to-record accelerator editor for the `menu-shortcut` key. */
    _buildShortcutRow() {
        const row = new Adw.ActionRow({
            title: 'Shortcut',
            subtitle: 'Click Change, then press the keys you want'
        });

        const label = new Gtk.ShortcutLabel({
            valign: Gtk.Align.CENTER,
            disabled_text: 'Not set'
        });
        const syncLabel = () => {
            label.set_accelerator(this._settings.get_strv('menu-shortcut')[0] ?? '');
        };
        syncLabel();
        row.add_suffix(label);

        const changeBtn = new Gtk.Button({
            label: 'Change',
            valign: Gtk.Align.CENTER
        });
        changeBtn.connect('clicked', () => this._captureShortcut(syncLabel));
        row.add_suffix(changeBtn);

        const clearBtn = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Clear shortcut',
            css_classes: ['flat']
        });
        clearBtn.connect('clicked', () => {
            this._settings.set_strv('menu-shortcut', []);
            syncLabel();
        });
        row.add_suffix(clearBtn);

        return row;
    }

    _captureShortcut(onCaptured) {
        const dialog = new Adw.AlertDialog({
            heading: 'Press a shortcut',
            body: 'Use a modifier such as Ctrl, Alt or Super. Press Escape to cancel.'
        });
        dialog.add_response('cancel', 'Cancel');
        dialog.set_close_response('cancel');

        const controller = new Gtk.EventControllerKey();
        // Capture, so the keystroke is read before any focused child consumes it.
        controller.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        dialog.add_controller(controller);

        controller.connect('key-pressed', (_c, keyval, keycode, state) => {
            const mask = state & Gtk.accelerator_get_default_mod_mask();

            if (keyval === Gdk.KEY_Escape && mask === 0) {
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            // A bare key would shadow ordinary typing everywhere.
            if (mask === 0 || !Gtk.accelerator_valid(keyval, mask)) return Gdk.EVENT_STOP;

            const accel = Gtk.accelerator_name_with_keycode(null, keyval, keycode, mask);
            this._settings.set_strv('menu-shortcut', [accel]);
            onCaptured();
            dialog.close();
            return Gdk.EVENT_STOP;
        });

        dialog.present(this.get_root());
    }
});
