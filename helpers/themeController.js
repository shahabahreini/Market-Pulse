/* Market Pulse — Shell theme coordination
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Gio from 'gi://Gio';

const THEME_CLASSES = ['market-pulse-theme-light', 'market-pulse-theme-dark'];

/** Resolves the user preference into one theme class and keeps it current. */
export class ThemeController {
    constructor(settingsHelper, onThemeChanged) {
        this._settings = settingsHelper;
        this._onThemeChanged = onThemeChanged;
        this._themeClass = null;
        this._interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
        this._interfaceSignalId = this._interfaceSettings.connect('changed::color-scheme', () => {
            if (this._settings.get('theme-mode') === 'system') this._sync();
        });
        this._settings.connect('theme-mode', () => this._sync());
        this._sync();
    }

    get themeClass() {
        return this._themeClass;
    }

    applyTo(actor) {
        if (!actor || !this._themeClass) return;
        for (const className of THEME_CLASSES) actor.remove_style_class_name(className);
        actor.add_style_class_name(this._themeClass);
    }

    _sync() {
        const preference = this._settings.get('theme-mode') || 'system';
        const scheme = preference === 'system'
            ? this._interfaceSettings.get_string('color-scheme')
            : preference;
        const nextClass = scheme === 'dark' || scheme === 'prefer-dark'
            ? 'market-pulse-theme-dark'
            : 'market-pulse-theme-light';
        if (nextClass === this._themeClass) return;

        this._themeClass = nextClass;
        this._onThemeChanged?.(nextClass);
    }

    destroy() {
        if (this._interfaceSignalId) {
            this._interfaceSettings.disconnect(this._interfaceSignalId);
            this._interfaceSignalId = null;
        }
        this._interfaceSettings = null;
        this._onThemeChanged = null;
        this._settings = null;
        this._themeClass = null;
    }
}
