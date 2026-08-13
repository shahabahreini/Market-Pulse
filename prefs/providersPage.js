/* Market Pulse — preferences: providers
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

export const ProvidersPage = GObject.registerClass(
class ProvidersPage extends Adw.PreferencesPage {
    _init(settingsHelper) {
        super._init({
            title: 'Providers',
            icon_name: 'network-workgroup-symbolic'
        });

        this._settingsHelper = settingsHelper;
        const group = new Adw.PreferencesGroup({
            title: 'Quote Provider Registry',
            description: 'Select free, no-API-key market data sources and automatic failover order'
        });

        const providersList = [
            { id: 'yahoo', name: 'Yahoo Finance', desc: 'Global equities, ETFs, indices, crypto and forex (default)' },
            { id: 'eastmoney', name: 'Eastmoney (East Money)', desc: 'China A-Shares, SSE, SZSE, Hong Kong (default)' },
            { id: 'coingecko', name: 'CoinGecko Free', desc: 'Extended 24/7 cryptocurrency spot market rates' },
            { id: 'binance', name: 'Binance Public', desc: 'Real-time 24/7 crypto ticker pairs' }
        ];

        const enabled = this._settingsHelper.getEnabledProviders();

        for (const p of providersList) {
            const row = new Adw.SwitchRow({
                title: p.name,
                subtitle: p.desc,
                active: enabled.includes(p.id)
            });

            row.connect('notify::active', () => {
                const current = this._settingsHelper.getEnabledProviders();
                let updated;
                if (row.get_active()) {
                    updated = Array.from(new Set([...current, p.id]));
                } else {
                    updated = current.filter(id => id !== p.id);
                }
                if (updated.length === 0) updated = ['yahoo']; // Require at least 1 provider
                this._settingsHelper.setEnabledProviders(updated);
            });

            group.add(row);
        }

        this.add(group);

        // --- Currency conversion (not a quote source) ---
        const fxGroup = new Adw.PreferencesGroup({
            title: 'Currency Conversion',
            description: 'Quotes are converted using European Central Bank reference rates from Frankfurter'
        });

        const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'INR', 'SEK', 'NOK', 'BRL'];
        const currencyRow = new Adw.ComboRow({
            title: 'Display Currency',
            subtitle: 'Show every quote converted into this currency',
            model: new Gtk.StringList({ strings: currencies })
        });
        const current = this._settingsHelper.get('display-currency') || 'USD';
        currencyRow.set_selected(Math.max(0, currencies.indexOf(current)));
        currencyRow.connect('notify::selected', () => {
            this._settingsHelper.setString('display-currency', currencies[currencyRow.get_selected()]);
        });
        fxGroup.add(currencyRow);

        this.add(fxGroup);
    }
});
