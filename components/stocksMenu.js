/* Market Pulse — panel dropdown menu
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Sparkline } from './sparkline.js';
import { DetailView } from './detailView.js';
import { SymbolSearchDialog } from './searchDialog.js';
import { RenameDialog } from './renameDialog.js';
import { ConfirmDialog } from './confirmDialog.js';
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
        // and drop the row actors again on close.
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
        const refreshBtn = new St.Button({
            child: new St.Icon({ icon_name: 'view-refresh-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            accessible_name: 'Refresh quotes',
            track_hover: true,
            reactive: true,
            can_focus: true
        });
        this._connect(refreshBtn, 'clicked', () => this._scheduler.triggerRefresh());
        headerBox.add_child(refreshBtn);

        const maskBtn = new St.Button({
            child: new St.Icon({ icon_name: 'security-high-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            accessible_name: 'Toggle privacy masking',
            track_hover: true,
            reactive: true,
            can_focus: true
        });
        this._connect(maskBtn, 'clicked', () => {
            this._settings.setBoolean('hide-private-values', !this._settings.get('hide-private-values'));
            this.renderSymbolList();
        });
        headerBox.add_child(maskBtn);

        const addBtn = new St.Button({
            child: new St.Icon({ icon_name: 'list-add-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            accessible_name: 'Add symbol',
            track_hover: true,
            reactive: true,
            can_focus: true
        });
        this._connect(addBtn, 'clicked', () => {
            this._menu.close();
            this._openDialog(new SymbolSearchDialog(this._settings, this._registry, () => {
                this._scheduler.triggerRefresh();
            }));
        });
        headerBox.add_child(addBtn);

        headerSection.actor.add_child(headerBox);

        this._offlineLabel = new St.Label({
            text: '',
            style_class: 'market-pulse-offline-banner'
        });
        this._offlineLabel.hide();
        headerSection.actor.add_child(this._offlineLabel);

        // One chip per portfolio; only worth showing once there is a choice.
        this._portfolioBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'market-pulse-portfolio-box'
        });
        this._portfolioBox.hide();
        headerSection.actor.add_child(this._portfolioBox);

        this._menu.addMenuItem(headerSection);
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
        this._detailSection = new PopupMenu.PopupMenuSection();
        this._detailView = new DetailView(this._registry, this._settings);
        this._detailView.setPopOutHandler(symObj => {
            this._menu.close();
            // Toggles: a second press closes the widget it opened.
            this._extension.toggleWidget(this._extension.isWidgetOpen() ? null : symObj);
        });
        this._detailSection.actor.add_child(this._detailView);
        this._detailSection.actor.hide(); // Hidden until row selected
        this._menu.addMenuItem(this._detailSection);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
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
            label: 'Settings',
            style_class: 'button market-pulse-settings-link-btn',
            accessible_name: 'Open Market Pulse settings',
            track_hover: true,
            reactive: true,
            can_focus: true
        });
        this._connect(settingsBtn, 'clicked', () => {
            this._menu.close();
            this._extension.openPreferences();
        });
        footerBox.add_child(settingsBtn);

        footerSection.actor.add_child(footerBox);
        this._menu.addMenuItem(footerSection);
    }

    /** Called by the extension whenever the desktop widget opens or closes. */
    syncWidgetState() {
        this._detailView?.setWidgetOpen(this._extension.isWidgetOpen());
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

    /** Offline banner over cached data. */
    _renderOfflineBanner() {
        if (!this._offlineLabel) return;
        if (this._isOffline) {
            this._offlineLabel.set_text('Offline — showing last known quotes');
            this._offlineLabel.show();
        } else {
            this._offlineLabel.hide();
        }
    }

    /** Portfolio switcher chips, hidden while only one portfolio exists. */
    renderPortfolioSelector() {
        if (!this._portfolioBox) return;
        this._portfolioBox.destroy_all_children();

        const portfolios = this._settings.getPortfolios();
        const ids = Object.keys(portfolios);
        if (ids.length < 2) {
            this._portfolioBox.hide();
            return;
        }

        const activeId = this._settings.getActivePortfolioId();
        for (const id of ids) {
            const btn = new St.Button({
                label: portfolios[id].name,
                style_class: 'button market-pulse-popular-chip',
                accessible_name: `Switch to ${portfolios[id].name}`,
                track_hover: true,
                reactive: true,
                can_focus: true
            });
            if (id === activeId) btn.add_style_class_name('selected');
            btn.connect('clicked', () => {
                if (id === this._settings.getActivePortfolioId()) return;
                this._selectedSymbol = null;
                this._detailSection.actor.hide();
                // The extension's active-portfolio handler re-renders both the
                // symbol list and these chips, so nothing more is needed here.
                this._settings.setActivePortfolio(id);
            });
            this._portfolioBox.add_child(btn);
        }
        this._portfolioBox.show();
    }

    renderSymbolList() {
        if (!this._symbolBox) return;
        this._openActionBar = null;   // actors below are about to be destroyed
        this.renderPortfolioSelector();
        this._symbolBox.destroy_all_children();

        const portfolio = this._settings.getActivePortfolio();
        const symbols = portfolio.symbols;
        const isMasked = this._settings.get('hide-private-values');
        const isColorblind = this._settings.get('colorblind-mode');
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

        const pinned = this._settings.get('pinned-symbol');

        for (const [index, symObj] of symbols.entries()) {
            const quote = this._quotesMap[symObj.symbol];
            const rowBtn = new St.Button({
                style_class: 'button market-pulse-symbol-row',
                x_expand: true,
                track_hover: true,
                reactive: true,
                can_focus: true
            });
            const rowBox = new St.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL, style_class: 'market-pulse-row-box' });

            const hasError = !!quote?.error;
            const isStale = !hasError && !!quote?.isStale?.();
            if (hasError || isStale) rowBtn.add_style_class_name('market-pulse-row-stale');
            const nameBox = new St.BoxLayout({ orientation: Clutter.Orientation.VERTICAL, style_class: 'market-pulse-name-box' });

            const symRow = new St.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL });
            symRow.add_child(new St.Label({ text: symObj.symbol, style_class: 'market-pulse-row-sym' }));
            if (hasError) {
                // Per-symbol error badge — never fail silently.
                symRow.add_child(new St.Icon({
                    icon_name: 'dialog-warning-symbolic',
                    style_class: 'market-pulse-row-error-badge',
                    accessible_name: `Error updating ${symObj.symbol}: ${quote.error}`
                }));
            }
            nameBox.add_child(symRow);

            const descText = hasError
                ? `Last update ${Formatter.formatTime(quote.timestamp)}`
                : (isStale ? `Cached ${Formatter.formatTime(quote.timestamp)}` : symObj.displayLabel);
            nameBox.add_child(new St.Label({ text: descText, style_class: 'market-pulse-row-desc' }));
            rowBox.add_child(nameBox);
            const sparkline = new Sparkline(54, 22, isColorblind);
            if (quote && quote.sparkline && quote.sparkline.length > 1) {
                sparkline.setPoints(quote.sparkline, quote.change >= 0);
            }
            rowBox.add_child(sparkline);
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
            rowBtn.connect('clicked', () => {
                if (this._selectedSymbol === symObj.symbol) {
                    this._selectedSymbol = null;
                    this._detailSection.actor.hide();
                } else {
                    this._selectedSymbol = symObj.symbol;
                    this._detailView.setQuoteData(symObj, quote);
                    this.syncWidgetState();
                    this._detailSection.actor.show();
                }
            });

            // Row plus its (initially collapsed) action bar, so managing a
            // symbol never means opening Preferences.
            const rowContainer = new St.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                style_class: 'market-pulse-row-container'
            });
            const topLine = new St.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL });
            topLine.add_child(rowBtn);

            const moreBtn = new St.Button({
                child: new St.Icon({ icon_name: 'view-more-symbolic', style_class: 'popup-menu-icon' }),
                style_class: 'button market-pulse-icon-btn market-pulse-row-more-btn',
                accessible_name: `Manage ${symObj.symbol}`,
                track_hover: true,
                reactive: true,
                can_focus: true
            });
            topLine.add_child(moreBtn);
            rowContainer.add_child(topLine);

            const actionBar = this._buildRowActions(symObj, index, symbols.length, pinned);
            actionBar.hide();
            rowContainer.add_child(actionBar);

            moreBtn.connect('clicked', () => {
                const wasOpen = actionBar.visible;
                this._collapseRowActions();
                if (!wasOpen) {
                    actionBar.show();
                    this._openActionBar = actionBar;
                }
            });

            this._symbolBox.add_child(rowContainer);
        }
    }

    _collapseRowActions() {
        if (this._openActionBar) {
            // The bar may already be gone if the list re-rendered underneath.
            try {
                this._openActionBar.hide();
            } catch (e) {
                // Actor finalized — nothing to collapse.
            }
            this._openActionBar = null;
        }
    }

    /** Pin / rename / reorder / remove, inline under the symbol row. */
    _buildRowActions(symObj, index, total, pinned) {
        const bar = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            style_class: 'market-pulse-row-actions'
        });

        const addAction = (iconName, label, callback, sensitive = true) => {
            const btn = new St.Button({
                child: new St.Icon({ icon_name: iconName, style_class: 'popup-menu-icon' }),
                style_class: 'button market-pulse-icon-btn',
                accessible_name: label,
                reactive: sensitive,
                track_hover: sensitive,
                can_focus: sensitive
            });
            if (!sensitive) btn.add_style_class_name('market-pulse-action-disabled');
            else btn.connect('clicked', callback);
            bar.add_child(btn);
            return btn;
        };

        const isPinned = pinned === symObj.symbol;
        addAction(
            'view-pin-symbolic',
            isPinned ? `Unpin ${symObj.symbol} from the top bar` : `Pin ${symObj.symbol} to the top bar`,
            () => {
                this._settings.setString('pinned-symbol', isPinned ? '' : symObj.symbol);
                this._panelButton.refreshDisplay();
                this.renderSymbolList();
            }
        ).add_style_class_name(isPinned ? 'selected' : 'market-pulse-action-idle');

        addAction('document-edit-symbolic', `Rename ${symObj.symbol}`, () => {
            this._menu.close();
            this._openDialog(new RenameDialog(symObj, this._settings, () => {
                this._panelButton.refreshDisplay();
                this.renderSymbolList();
            }));
        });

        addAction('go-up-symbolic', `Move ${symObj.symbol} up`, () => {
            this._settings.moveSymbolInActivePortfolio(symObj.symbol, -1);
            this._panelButton.refreshDisplay();
            this.renderSymbolList();
        }, index > 0);

        addAction('go-down-symbolic', `Move ${symObj.symbol} down`, () => {
            this._settings.moveSymbolInActivePortfolio(symObj.symbol, 1);
            this._panelButton.refreshDisplay();
            this.renderSymbolList();
        }, index < total - 1);

        addAction('user-trash-symbolic', `Remove ${symObj.symbol}`, () => {
            this._menu.close();
            this._openDialog(new ConfirmDialog({
                heading: `Remove ${symObj.symbol}?`,
                body: `${symObj.displayLabel} and its recorded holdings will be removed from this portfolio.`
            }, () => {
                this._settings.removeSymbolFromActivePortfolio(symObj.symbol);
                if (this._selectedSymbol === symObj.symbol) {
                    this._selectedSymbol = null;
                    this._detailSection.actor.hide();
                }
                this._panelButton.refreshDisplay();
                this.renderSymbolList();
            }));
        });

        return bar;
    }

    /** Tracks the dialog so destroy() can tear down one left open. */
    _openDialog(dialog) {
        this._dialog = dialog;
        dialog.connect('closed', () => {
            if (this._dialog === dialog) this._dialog = null;
        });
        dialog.open();
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
