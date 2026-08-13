/* Market Pulse — preferences: about
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

export const AboutPage = GObject.registerClass(
class AboutPage extends Adw.PreferencesPage {
    _init(version, extensionPath) {
        super._init({
            title: 'About',
            icon_name: 'help-about-symbolic'
        });

        const group = new Adw.PreferencesGroup();

        if (extensionPath) {
            group.add(new Gtk.Image({
                file: `${extensionPath}/icons/market-pulse-icon.svg`,
                pixel_size: 96,
                margin_top: 12,
                margin_bottom: 12
            }));
        }

        group.add(new Adw.ActionRow({
            title: 'Market Pulse',
            subtitle: `Version ${version}`
        }));

        group.add(new Adw.ActionRow({
            title: 'Author',
            subtitle: 'Shahab Bahreini Jangjoo (github.com/shahabahreini)'
        }));

        group.add(new Adw.ActionRow({
            title: 'License',
            subtitle: 'GPL-3.0-or-later'
        }));

        this.add(group);

        const dataGroup = new Adw.PreferencesGroup({
            title: 'Data Sources',
            description: 'Quotes come from public endpoints that need no account or API key. ' +
                'Holdings and portfolio values are stored locally and are never transmitted.'
        });

        for (const [name, detail] of [
            ['Yahoo Finance', 'Equities, ETFs, indices, crypto, forex'],
            ['Eastmoney', 'Shanghai and Shenzhen listed shares'],
            ['CoinGecko', 'Cryptocurrency spot prices'],
            ['Binance', 'Cryptocurrency trading pairs'],
            ['Frankfurter', 'European Central Bank reference rates']
        ]) {
            dataGroup.add(new Adw.ActionRow({ title: name, subtitle: detail }));
        }

        this.add(dataGroup);
    }
});
