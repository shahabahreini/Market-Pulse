/**
 * Market Pulse — GNOME Shell Search Provider (plan §C11)
 *
 * Surfaces tracked symbols in the overview search. Results are served entirely
 * from the local quote cache: typing in the overview must never trigger a
 * network request.
 *
 * GPL-3.0 License
 */

import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Formatter } from '../helpers/formatter.js';

export class MarketPulseSearchProvider {
    constructor(extension, settingsHelper, cache) {
        this._extension = extension;
        this._settings = settingsHelper;
        this._cache = cache;

        // Shown as the result-group header in the overview.
        this.appInfo = Gio.AppInfo.create_from_commandline(
            'gnome-extensions prefs market-pulse@shahabahreini.github.com',
            'Market Pulse',
            Gio.AppInfoCreateFlags.NONE
        );
        this.appInfo.get_name = () => 'Market Pulse';
        this.appInfo.get_icon = () => new Gio.ThemedIcon({ name: 'market-pulse-symbolic' });
        this.appInfo.should_show = () => false;

        this.id = extension.uuid;
    }

    _matchingSymbols(terms) {
        const query = terms.join(' ').toLowerCase().trim();
        if (!query) return [];

        const portfolio = this._settings.getActivePortfolio();
        return portfolio.symbols
            .filter(s =>
                s.symbol.toLowerCase().includes(query) ||
                (s.name || '').toLowerCase().includes(query))
            .map(s => s.symbol);
    }

    getInitialResultSet(terms, cancellable) {
        return new Promise(resolve => {
            if (cancellable?.is_cancelled()) {
                resolve([]);
                return;
            }
            resolve(this._matchingSymbols(terms));
        });
    }

    getSubsearchResultSet(previousResults, terms, cancellable) {
        return this.getInitialResultSet(terms, cancellable);
    }

    getResultMetas(identifiers, cancellable) {
        return new Promise(resolve => {
            if (cancellable?.is_cancelled()) {
                resolve([]);
                return;
            }

            const isMasked = this._settings.get('hide-private-values');
            const portfolio = this._settings.getActivePortfolio();

            const metas = identifiers.map(id => {
                const symObj = portfolio.symbols.find(s => s.symbol === id);
                const quote = this._cache.get(id);

                let description;
                if (isMasked) {
                    description = '••••••';
                } else if (quote) {
                    description = `${Formatter.formatCurrency(quote.price, quote.currency)} ` +
                        `(${Formatter.formatPercent(quote.changePercent)})`;
                } else {
                    description = 'No quote yet';
                }

                return {
                    id,
                    name: symObj?.name || id,
                    description,
                    createIcon: size => new St.Icon({
                        icon_name: 'market-pulse-symbolic',
                        icon_size: size
                    })
                };
            });

            resolve(metas);
        });
    }

    /** Selecting a result opens the panel menu focused on that symbol. */
    activateResult(result) {
        Main.overview.hide();
        this._onActivate?.(result);
    }

    setActivateHandler(handler) {
        this._onActivate = handler;
    }

    launchSearch() {
        Main.overview.hide();
        this._onActivate?.(null);
    }

    filterResults(results, maxResults) {
        return results.slice(0, maxResults);
    }

    destroy() {
        this._onActivate = null;
        this._cache = null;
        this._settings = null;
        this._extension = null;
    }
}
