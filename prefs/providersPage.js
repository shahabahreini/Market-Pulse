/**
 * Market Pulse — Preferences Providers Page
 * GPL-3.0 License
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
            { id: 'yahoo', name: 'Yahoo Finance', desc: 'Global Equities, ETFs, Indices, Crypto, Forex (Default)' },
            { id: 'eastmoney', name: 'Eastmoney (East Money)', desc: 'China A-Shares, SSE, SZSE, Hong Kong (Default)' },
            { id: 'stooq', name: 'Stooq', desc: 'Historical CSV data for equities, global indices & commodities' },
            { id: 'coingecko', name: 'CoinGecko Free', desc: 'Extended 24/7 cryptocurrency spot market rates' },
            { id: 'binance', name: 'Binance Public', desc: 'Real-time 24/7 crypto ticker pairs' },
            { id: 'frankfurter', name: 'Frankfurter (ECB)', desc: 'European Central Bank foreign exchange rates for currency conversion' }
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
    }
});
