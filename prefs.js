/**
 * Market Pulse — Preferences Window (GNOME 46+ Libadwaita)
 * GPL-3.0 License
 */

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { GeneralPage } from './prefs/generalPage.js';
import { PortfolioPage } from './prefs/portfolioPage.js';
import { ProvidersPage } from './prefs/providersPage.js';
import { AlertsPage } from './prefs/alertsPage.js';
import { AboutPage } from './prefs/aboutPage.js';
import { SettingsHelper } from './helpers/settings.js';

export default class MarketPulsePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settingsHelper = new SettingsHelper(this);

        window.add(new GeneralPage(settingsHelper));
        window.add(new PortfolioPage(settingsHelper));
        window.add(new ProvidersPage(settingsHelper));
        window.add(new AlertsPage(settingsHelper));
        window.add(new AboutPage(this));

        // Flush pending writes and disconnect handlers when the window closes.
        window.connect('close-request', () => {
            settingsHelper.destroy();
            return false;
        });
    }
}
