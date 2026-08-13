/**
 * Market Pulse — Preferences About Page
 * GPL-3.0 License
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

export const AboutPage = GObject.registerClass(
class AboutPage extends Adw.PreferencesPage {
    _init(extension) {
        super._init({
            title: 'About',
            icon_name: 'help-about-symbolic'
        });

        const group = new Adw.PreferencesGroup();

        const banner = new Adw.ActionRow({
            title: 'Market Pulse v1.0',
            subtitle: 'Clean-room GNOME Shell Extension for stocks, crypto, and local portfolio P&L tracking.'
        });
        group.add(banner);

        const attrRow = new Adw.ActionRow({
            title: 'Attribution & Inspiration',
            subtitle: 'Inspired by cinatic/stocks-extension (reference design only). Clean-room GJS implementation under GPL-3.0.'
        });
        group.add(attrRow);

        const authorRow = new Adw.ActionRow({
            title: 'Author',
            subtitle: 'Shahab Ahreini (github.com/shahabahreini)'
        });
        group.add(authorRow);

        this.add(group);
    }
});
