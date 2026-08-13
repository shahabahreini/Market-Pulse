/**
 * Market Pulse — Symbol Live Search Modal Dialog
 * GPL-3.0 License
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { SymbolData } from '../helpers/models.js';

export const SymbolSearchDialog = GObject.registerClass(
class SymbolSearchDialog extends ModalDialog.ModalDialog {
    _init(settingsHelper, providerRegistry, onSymbolAddedCallback) {
        super._init({ styleClass: 'market-pulse-search-dialog' });

        this._settingsHelper = settingsHelper;
        this._registry = providerRegistry;
        this._onSymbolAdded = onSymbolAddedCallback;
        this._searchDebounceId = null;

        const content = this.contentLayout;
        content.set_style('width: 440px; padding: 16px;');

        const title = new St.Label({
            text: '🔍 Add Stock or Crypto Symbol',
            style_class: 'market-pulse-dialog-title'
        });
        content.add_child(title);

        // Search Input Entry
        this._entry = new St.Entry({
            hint_text: 'Search AAPL, TSLA, BTC-USD, S&P 500...',
            style_class: 'market-pulse-search-entry',
            can_focus: true
        });
        content.add_child(this._entry);

        this._entry.clutter_text.connect('text-changed', () => {
            this._onSearchTextChanged();
        });

        // Results Container Box
        this._resultsScroll = new St.ScrollView({
            style_class: 'market-pulse-search-results-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            height: 240
        });

        this._resultsBox = new St.BoxLayout({
            vertical: true,
            style_class: 'market-pulse-search-results-box'
        });
        this._resultsScroll.add_child(this._resultsBox);
        content.add_child(this._resultsScroll);

        // Quick Popular Choices Row
        this._popularBox = new St.BoxLayout({
            vertical: false,
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
                style_class: 'button market-pulse-popular-chip'
            });
            btn.connect('clicked', () => {
                this._addSymbol(new SymbolData({ symbol: item.sym, name: item.name }));
            });
            this._popularBox.add_child(btn);
        }
        content.add_child(this._popularBox);

        // Dialog Action Buttons
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
        this._resultsBox.destroy_all_children();

        const loadingLabel = new St.Label({ text: 'Searching market quotes...', style_class: 'market-pulse-loading-label' });
        this._resultsBox.add_child(loadingLabel);

        const providers = this._registry.getEnabledProviders();
        let results = [];

        for (const p of providers) {
            try {
                if (p.searchSymbols) {
                    const res = await p.searchSymbols(query);
                    if (res && res.length > 0) {
                        results = results.concat(res);
                    }
                }
            } catch (e) {
                console.warn(`[market-pulse] Search error on ${p.name}: ${e.message}`);
            }
        }

        this._resultsBox.destroy_all_children();

        if (results.length === 0) {
            const emptyLabel = new St.Label({
                text: `No symbols found matching "${query}"`,
                style_class: 'market-pulse-empty-search-label'
            });
            this._resultsBox.add_child(emptyLabel);
            return;
        }

        for (const item of results.slice(0, 10)) {
            const rowBtn = new St.Button({ style_class: 'button market-pulse-search-result-row' });
            const rowBox = new St.BoxLayout({ vertical: false, style_class: 'market-pulse-search-result-box' });

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

    _addSymbol(symbolObj) {
        this._settingsHelper.addSymbolToActivePortfolio(symbolObj);
        if (this._onSymbolAdded) {
            this._onSymbolAdded(symbolObj);
        }
        this.close();
    }

    destroy() {
        if (this._searchDebounceId) {
            GLib.Source.remove(this._searchDebounceId);
            this._searchDebounceId = null;
        }
        super.destroy();
    }
});
