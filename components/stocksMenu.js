/**
 * Market Pulse — Popup Menu Component
 * GPL-3.0 License
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Sparkline } from './sparkline.js';
import { DetailView } from './detailView.js';
import { SymbolSearchDialog } from './searchDialog.js';
import { PortfolioCalculator } from '../services/portfolioCalculator.js';
import { Formatter } from '../helpers/formatter.js';

export class StocksMenu {
    constructor(panelButton, extension, settingsHelper, pollingScheduler, providerRegistry) {
        this._panelButton = panelButton;
        this._extension = extension;
        this._settings = settingsHelper;
        this._scheduler = pollingScheduler;
        this._registry = providerRegistry;
        this._menu = panelButton.menu;
        this._quotesMap = {};
        this._selectedSymbol = null;
        this._lastUpdatedTime = null;
        this._isOffline = false;
        this._signals = [];
        this._dialog = null;

        this._buildMenu();

        // Render on open so the menu is never blank before the first poll,
        // and drop the row actors again on close (plan §A5).
        this._connect(this._menu, 'open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                this.renderSymbolList();
            } else {
                this._selectedSymbol = null;
                this._detailSection.actor.hide();
                this._symbolBox.destroy_all_children();
            }
        });
    }

    /** Tracks every handler so disable() can disconnect all of them. */
    _connect(source, signal, callback) {
        const id = source.connect(signal, callback);
        this._signals.push([source, id]);
        return id;
    }

    _buildMenu() {
        this._menu.removeAll();

        // 1. Header Section
        const headerSection = new PopupMenu.PopupMenuSection();
        const headerBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'market-pulse-menu-header'
        });

        this._titleLabel = new St.Label({
            text: 'Market Pulse',
            style_class: 'market-pulse-menu-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        headerBox.add_child(this._titleLabel);

        // Header Action Buttons
        const refreshBtn = new St.Button({
            child: new St.Icon({ icon_name: 'view-refresh-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            accessible_name: 'Refresh quotes'
        });
        this._connect(refreshBtn, 'clicked', () => this._scheduler.triggerRefresh());
        headerBox.add_child(refreshBtn);

        const maskBtn = new St.Button({
            child: new St.Icon({ icon_name: 'security-high-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            accessible_name: 'Toggle privacy masking'
        });
        this._connect(maskBtn, 'clicked', () => {
            this._settings.setBoolean('hide-private-values', !this._settings.get('hide-private-values'));
            this.renderSymbolList();
        });
        headerBox.add_child(maskBtn);

        const addBtn = new St.Button({
            child: new St.Icon({ icon_name: 'list-add-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            accessible_name: 'Add symbol'
        });
        this._connect(addBtn, 'clicked', () => {
            this._menu.close();
            this._dialog = new SymbolSearchDialog(this._settings, this._registry, () => {
                this._dialog = null;
                this._scheduler.triggerRefresh();
            });
            this._dialog.open();
        });
        headerBox.add_child(addBtn);

        headerSection.actor.add_child(headerBox);

        this._offlineLabel = new St.Label({
            text: '',
            style_class: 'market-pulse-offline-banner'
        });
        this._offlineLabel.hide();
        headerSection.actor.add_child(this._offlineLabel);

        this._menu.addMenuItem(headerSection);

        // 2. Portfolio P&L Summary Banner
        this._summarySection = new PopupMenu.PopupMenuSection();
        this._summaryBox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'market-pulse-summary-banner'
        });
        this._summaryValLabel = new St.Label({ text: '', style_class: 'market-pulse-summary-val' });
        this._summaryGainLabel = new St.Label({ text: '', style_class: 'market-pulse-summary-gain' });
        this._summaryBox.add_child(this._summaryValLabel);
        this._summaryBox.add_child(this._summaryGainLabel);
        this._summarySection.actor.add_child(this._summaryBox);
        this._menu.addMenuItem(this._summarySection);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 3. Scrollable Symbol List Section
        this._symbolListSection = new PopupMenu.PopupMenuSection();
        this._symbolScroll = new St.ScrollView({
            style_class: 'market-pulse-symbol-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            height: 280
        });
        this._symbolBox = new St.BoxLayout({ orientation: Clutter.Orientation.VERTICAL, style_class: 'market-pulse-symbol-list' });
        this._symbolScroll.add_child(this._symbolBox);
        this._symbolListSection.actor.add_child(this._symbolScroll);
        this._menu.addMenuItem(this._symbolListSection);

        // 4. Detail View Card (Collapsible)
        this._detailSection = new PopupMenu.PopupMenuSection();
        this._detailView = new DetailView(this._registry, this._settings);
        this._detailView.setPopOutHandler(symObj => {
            this._menu.close();
            this._extension.toggleWidget(symObj);
        });
        this._detailSection.actor.add_child(this._detailView);
        this._detailSection.actor.hide(); // Hidden until row selected
        this._menu.addMenuItem(this._detailSection);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 5. Freshness Footer & Bottom Settings Action Item
        const footerSection = new PopupMenu.PopupMenuSection();
        const footerBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'market-pulse-menu-footer'
        });

        this._freshnessLabel = new St.Label({
            text: 'Updated: --:--',
            style_class: 'market-pulse-freshness-label',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        footerBox.add_child(this._freshnessLabel);

        const settingsBtn = new St.Button({
            label: '⚙️ Settings',
            style_class: 'button market-pulse-settings-link-btn',
            accessible_name: 'Open Market Pulse settings'
        });
        this._connect(settingsBtn, 'clicked', () => {
            this._menu.close();
            this._extension.openPreferences();
        });
        footerBox.add_child(settingsBtn);

        footerSection.actor.add_child(footerBox);
        this._menu.addMenuItem(footerSection);
    }

    updateQuotes(quotesMap, state = null) {
        this._quotesMap = quotesMap;
        this._isOffline = !!state?.offline;
        if (!this._isOffline) this._lastUpdatedTime = Date.now();

        if (this._freshnessLabel) {
            this._freshnessLabel.set_text(this._lastUpdatedTime
                ? `Updated: ${Formatter.formatTime(this._lastUpdatedTime)}`
                : 'Updated: --:--');
        }
        this._renderOfflineBanner();

        // Rows only exist while the menu is open.
        if (this._menu?.isOpen) this.renderSymbolList();
    }

    /** Offline banner over cached data (plan §A3/§C9). */
    _renderOfflineBanner() {
        if (!this._offlineLabel) return;
        if (this._isOffline) {
            this._offlineLabel.set_text('⚠ Offline — showing last known quotes');
            this._offlineLabel.show();
        } else {
            this._offlineLabel.hide();
        }
    }

    renderSymbolList() {
        if (!this._symbolBox) return;
        this._symbolBox.destroy_all_children();

        const portfolio = this._settings.getActivePortfolio();
        const symbols = portfolio.symbols;
        const isMasked = this._settings.get('hide-private-values');
        const isColorblind = this._settings.get('colorblind-mode');

        // Update Summary Banner
        const baseCurrency = this._settings.get('display-currency') || 'USD';
        const pSummary = PortfolioCalculator.calculatePortfolioSummary(portfolio, this._quotesMap, isMasked);
        if (pSummary.hasHoldings) {
            this._summarySection.actor.show();
            this._summaryValLabel.set_text(`Total Portfolio: ${PortfolioCalculator.formatValueOrMask(pSummary.totalValue, baseCurrency, isMasked)}`);
            this._summaryGainLabel.set_text(`P&L: ${PortfolioCalculator.formatValueOrMask(pSummary.totalGain, baseCurrency, isMasked)} (${Formatter.formatPercent(pSummary.totalGainPct)})`);
        } else {
            this._summarySection.actor.hide();
        }

        if (symbols.length === 0) {
            const emptyLabel = new St.Label({
                text: 'No symbols added yet.\nClick "+" above to search & track stocks/crypto.',
                style_class: 'market-pulse-empty-list-label'
            });
            this._symbolBox.add_child(emptyLabel);
            return;
        }

        for (const symObj of symbols) {
            const quote = this._quotesMap[symObj.symbol];
            const rowBtn = new St.Button({ style_class: 'button market-pulse-symbol-row' });
            const rowBox = new St.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL, style_class: 'market-pulse-row-box' });

            const hasError = !!quote?.error;
            const isStale = !hasError && !!quote?.isStale?.();
            if (hasError || isStale) rowBtn.add_style_class_name('market-pulse-row-stale');

            // Symbol Name & Type
            const nameBox = new St.BoxLayout({ orientation: Clutter.Orientation.VERTICAL, style_class: 'market-pulse-name-box' });

            const symRow = new St.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL });
            symRow.add_child(new St.Label({ text: symObj.symbol, style_class: 'market-pulse-row-sym' }));
            if (hasError) {
                // Per-symbol error badge (plan §A3) — never fail silently.
                symRow.add_child(new St.Icon({
                    icon_name: 'dialog-warning-symbolic',
                    style_class: 'market-pulse-row-error-badge',
                    accessible_name: `Error updating ${symObj.symbol}: ${quote.error}`
                }));
            }
            nameBox.add_child(symRow);

            const descText = hasError
                ? `Last update ${Formatter.formatTime(quote.timestamp)}`
                : (isStale ? `Cached ${Formatter.formatTime(quote.timestamp)}` : symObj.name);
            nameBox.add_child(new St.Label({ text: descText, style_class: 'market-pulse-row-desc' }));
            rowBox.add_child(nameBox);

            // Mini Sparkline (Cairo)
            const sparkline = new Sparkline(54, 22, isColorblind);
            if (quote && quote.sparkline && quote.sparkline.length > 1) {
                sparkline.setPoints(quote.sparkline, quote.change >= 0);
            }
            rowBox.add_child(sparkline);

            // Price & Percent Chip
            const priceBox = new St.BoxLayout({ orientation: Clutter.Orientation.VERTICAL, style_class: 'market-pulse-price-box' });
            // Loading state until the first quote for this symbol arrives.
            if (!quote) rowBtn.add_style_class_name('market-pulse-row-loading');
            const priceVal = quote ? Formatter.formatCurrency(quote.price, quote.currency) : '···';
            const priceLabel = new St.Label({
                text: isMasked ? '••••••' : priceVal,
                style_class: 'market-pulse-row-price'
            });

            const pctVal = quote ? Formatter.formatPercent(quote.changePercent) : '—';
            const isUp = quote ? quote.change >= 0 : true;
            let chipClass = 'market-pulse-pct-chip';
            if (quote) {
                if (isUp) chipClass += isColorblind ? ' chip-blue' : ' chip-green';
                else chipClass += isColorblind ? ' chip-orange' : ' chip-red';
            }

            const pctChip = new St.Label({
                text: isMasked ? '••••' : pctVal,
                style_class: chipClass
            });

            priceBox.add_child(priceLabel);
            priceBox.add_child(pctChip);
            rowBox.add_child(priceBox);

            rowBtn.set_child(rowBox);

            // Click row -> toggle DetailView expansion
            rowBtn.connect('clicked', () => {
                if (this._selectedSymbol === symObj.symbol) {
                    this._selectedSymbol = null;
                    this._detailSection.actor.hide();
                } else {
                    this._selectedSymbol = symObj.symbol;
                    this._detailView.setQuoteData(symObj, quote);
                    this._detailSection.actor.show();
                }
            });

            this._symbolBox.add_child(rowBtn);
        }
    }

    destroy() {
        for (const [source, id] of this._signals) {
            try {
                source.disconnect(id);
            } catch (e) {
                // Source already finalized — nothing to disconnect.
            }
        }
        this._signals = [];

        if (this._dialog) {
            this._dialog.destroy();
            this._dialog = null;
        }
        if (this._detailView) {
            this._detailView.destroy();
            this._detailView = null;
        }
        if (this._menu) {
            this._menu.removeAll();
        }

        this._symbolBox = null;
        this._symbolScroll = null;
        this._summarySection = null;
        this._detailSection = null;
        this._freshnessLabel = null;
        this._quotesMap = {};
        this._selectedSymbol = null;
    }
}
