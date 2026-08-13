/* Market Pulse — preferences window
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { GeneralPage } from './prefs/generalPage.js';
import { PortfolioPage } from './prefs/portfolioPage.js';
import { ProvidersPage } from './prefs/providersPage.js';
import { AlertsPage } from './prefs/alertsPage.js';
import { AboutPage } from './prefs/aboutPage.js';
import { SettingsHelper } from './helpers/settings.js';

export default class MarketPulsePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        try {
            const display = Gdk.Display.get_default();
            if (display && this.path) {
                const iconTheme = Gtk.IconTheme.get_for_display(display);
                if (iconTheme) {
                    iconTheme.add_search_path(`${this.path}/icons`);
                    iconTheme.add_search_path(`${this.path}/icons/hicolor`);
                }
            }
        } catch (e) {
            console.warn(`[market-pulse] Could not register icon theme search paths: ${e.message}`);
        }

        const settingsHelper = new SettingsHelper(this);

        window.add(new GeneralPage(settingsHelper));
        window.add(new PortfolioPage(settingsHelper));
        window.add(new ProvidersPage(settingsHelper));
        window.add(new AlertsPage(settingsHelper));
        window.add(new AboutPage(
            this.metadata['version-name'] ?? String(this.metadata.version),
            this.path
        ));

        // Flush pending writes and disconnect handlers when the window closes.
        window.connect('close-request', () => {
            settingsHelper.destroy();
            return false;
        });
    }
}
