/* Market Pulse — symbol search dialog
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { SymbolData } from '../helpers/models.js';
import { PRESETS } from '../helpers/presets.js';

export const SymbolSearchDialog = GObject.registerClass(
class SymbolSearchDialog extends ModalDialog.ModalDialog {
    _init(settingsHelper, providerRegistry, onSymbolAddedCallback) {
        super._init({ styleClass: 'market-pulse-search-dialog' });

        this._settingsHelper = settingsHelper;
        this._registry = providerRegistry;
        this._onSymbolAdded = onSymbolAddedCallback;
        this._searchDebounceId = null;
        this._searchCancellable = null;
        this._searchSerial = 0;

        // ModalDialog does not destroy itself on close — do it explicitly so
        // the debounce source and in-flight search never outlive the dialog.
        this.connect('closed', () => this.destroy());

        const content = this.contentLayout;
        content.set_style('width: 440px; padding: 16px;');

        const title = new St.Label({
            text: 'Add Symbol',
            style_class: 'market-pulse-dialog-title'
        });
        content.add_child(title);
        this._entry = new St.Entry({
            hint_text: 'Search AAPL, TSLA, BTC-USD, S&P 500...',
            style_class: 'market-pulse-search-entry',
            can_focus: true
        });
        content.add_child(this._entry);

        this._entry.clutter_text.connect('text-changed', () => {
            this._onSearchTextChanged();
        });
        this._resultsScroll = new St.ScrollView({
            style_class: 'market-pulse-search-results-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            height: 240
        });

        this._resultsBox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'market-pulse-search-results-box'
        });
        this._resultsScroll.add_child(this._resultsBox);
        content.add_child(this._resultsScroll);
        this._popularBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'market-pulse-popular-box'
        });
        const popular = [
            { sym: '^GSPC', name: 'S&P 500' },
            { sym: '^IXIC', name: 'NASDAQ' },
            { sym: 'BTC-USD', name: 'Bitcoin' },
            { sym: 'AAPL', name: 'Apple' }
        ];

        for (const item of popular) {
            const btn = new St.Button({
                label: item.sym,
                style_class: 'button market-pulse-popular-chip',
                accessible_name: `Add ${item.name}`
            });
            btn.connect('clicked', () => {
                this._addSymbol(new SymbolData({ symbol: item.sym, name: item.name }));
            });
            this._popularBox.add_child(btn);
        }
        content.add_child(this._popularBox);

        // Whole starter lists in one press, for users who do not have a
        // particular ticker in mind.
        const presetBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'market-pulse-popular-box'
        });
        presetBox.add_child(new St.Label({
            text: 'Lists:',
            style_class: 'market-pulse-recent-label',
            y_align: Clutter.ActorAlign.CENTER
        }));
        for (const preset of PRESETS) {
            const btn = new St.Button({
                label: preset.label,
                style_class: 'button market-pulse-popular-chip',
                accessible_name: `Add ${preset.label}: ${preset.description}`
            });
            btn.connect('clicked', () => this._addPreset(preset));
            presetBox.add_child(btn);
        }
        content.add_child(presetBox);

        // Recent searches — one click back to a previous lookup.
        const recent = settingsHelper.getRecentSearches();
        if (recent.length > 0) {
            const recentBox = new St.BoxLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                style_class: 'market-pulse-recent-box'
            });
            recentBox.add_child(new St.Label({
                text: 'Recent:',
                style_class: 'market-pulse-recent-label',
                y_align: Clutter.ActorAlign.CENTER
            }));

            for (const query of recent) {
                const btn = new St.Button({
                    label: query,
                    style_class: 'button market-pulse-popular-chip',
                    accessible_name: `Search again for ${query}`
                });
                btn.connect('clicked', () => {
                    this._entry.set_text(query);
                    this._entry.grab_key_focus();
                });
                recentBox.add_child(btn);
            }
            content.add_child(recentBox);
        }
        this.addButton({
            label: 'Cancel',
            action: () => this.close(),
            key: Clutter.KEY_Escape
        });
    }

    _onSearchTextChanged() {
        if (this._searchDebounceId) {
            GLib.Source.remove(this._searchDebounceId);
            this._searchDebounceId = null;
        }

        const query = this._entry.get_text().trim();
        if (query.length < 1) {
            this._resultsBox.destroy_all_children();
            return;
        }

        this._searchDebounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            this._doSearch(query);
            this._searchDebounceId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    async _doSearch(query) {
        // Stale-response guard: a slower earlier search must not overwrite a
        // newer one's results.
        const serial = ++this._searchSerial;

        if (this._searchCancellable) this._searchCancellable.cancel();
        this._searchCancellable = new Gio.Cancellable();
        const cancellable = this._searchCancellable;

        this._resultsBox.destroy_all_children();

        const loadingLabel = new St.Label({ text: 'Searching market quotes…', style_class: 'market-pulse-loading-label' });
        this._resultsBox.add_child(loadingLabel);

        const providers = this._registry.getEnabledProviders(this._settingsHelper.getEnabledProviders());
        let results = [];

        for (const p of providers) {
            try {
                if (p.searchSymbols) {
                    const res = await p.searchSymbols(query, cancellable);
                    if (res && res.length > 0) {
                        results = results.concat(res);
                    }
                }
            } catch (e) {
                console.warn(`[market-pulse] Search error on ${p.name}: ${e.message}`);
            }
        }

        if (serial !== this._searchSerial || !this._resultsBox) return;

        this._resultsBox.destroy_all_children();

        if (results.length === 0) {
            const emptyLabel = new St.Label({
                text: `No symbols found matching "${query}"`,
                style_class: 'market-pulse-empty-search-label'
            });
            this._resultsBox.add_child(emptyLabel);

            // Providers do not know every listing. Let the user add the ticker
            // anyway rather than dead-ending the search.
            const ticker = query.toUpperCase();
            const manualBtn = new St.Button({
                label: `Add "${ticker}" anyway`,
                style_class: 'button market-pulse-search-result-row',
                accessible_name: `Add ${ticker} without a search match`,
                x_expand: true
            });
            manualBtn.connect('clicked', () => {
                this._addSymbol(new SymbolData({ symbol: ticker, name: ticker }));
            });
            this._resultsBox.add_child(manualBtn);

            this._resultsBox.add_child(new St.Label({
                text: 'Prices will appear once a provider recognises the symbol.',
                style_class: 'market-pulse-empty-search-label'
            }));
            return;
        }

        for (const item of results.slice(0, 10)) {
            const rowBtn = new St.Button({ style_class: 'button market-pulse-search-result-row' });
            const rowBox = new St.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL, style_class: 'market-pulse-search-result-box' });

            const nameLabel = new St.Label({
                text: `${item.symbol} — ${item.name}`,
                x_expand: true,
                style_class: 'market-pulse-search-result-name'
            });

            const badgeLabel = new St.Label({
                text: item.type.toUpperCase(),
                style_class: `market-pulse-asset-badge market-pulse-badge-${item.type}`
            });

            rowBox.add_child(nameLabel);
            rowBox.add_child(badgeLabel);
            rowBtn.set_child(rowBox);

            rowBtn.connect('clicked', () => {
                this._addSymbol(new SymbolData(item));
            });

            this._resultsBox.add_child(rowBtn);
        }
    }

    _addPreset(preset) {
        for (const s of preset.symbols) {
            this._settingsHelper.addSymbolToActivePortfolio(new SymbolData(s));
        }
        this._onSymbolAdded?.(null);
        this.close();
    }

    _addSymbol(symbolObj) {
        this._settingsHelper.addRecentSearch(symbolObj.symbol);
        this._settingsHelper.addSymbolToActivePortfolio(symbolObj);
        if (this._onSymbolAdded) {
            this._onSymbolAdded(symbolObj);
        }
        this.close();
    }

    destroy() {
        // ModalDialog's 'closed' handler and an explicit close() both land
        // here; without this guard the second pass hits a disposed object.
        if (this._destroyed) return;
        this._destroyed = true;

        if (this._searchDebounceId) {
            GLib.Source.remove(this._searchDebounceId);
            this._searchDebounceId = null;
        }
        if (this._searchCancellable) {
            this._searchCancellable.cancel();
            this._searchCancellable = null;
        }
        this._resultsBox = null;
        super.destroy();
    }
});
