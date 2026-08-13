/**
 * Market Pulse — Popup Menu Component
 * GPL-3.0 License
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
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

        this._buildMenu();
    }

    _buildMenu() {
        this._menu.removeAll();

        // 1. Header Section
        const headerSection = new PopupMenu.PopupMenuSection();
        const headerBox = new St.BoxLayout({
            vertical: false,
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
            tooltip_text: 'Refresh quotes'
        });
        refreshBtn.connect('clicked', () => this._scheduler.triggerRefresh());
        headerBox.add_child(refreshBtn);

        const maskBtn = new St.Button({
            child: new St.Icon({ icon_name: 'security-high-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            tooltip_text: 'Toggle privacy masking'
        });
        maskBtn.connect('clicked', () => {
            const cur = this._settings.get('hide-private-values');
            this._settings.set('hide-private-values', new GLib.Variant('b', !cur));
        });
        headerBox.add_child(maskBtn);

        const addBtn = new St.Button({
            child: new St.Icon({ icon_name: 'list-add-symbolic', style_class: 'popup-menu-icon' }),
            style_class: 'button market-pulse-icon-btn',
            tooltip_text: 'Add symbol'
        });
        addBtn.connect('clicked', () => {
            this._menu.close();
            const dialog = new SymbolSearchDialog(this._settings, this._registry, () => {
                this._scheduler.triggerRefresh();
            });
            dialog.open();
        });
        headerBox.add_child(addBtn);

        headerSection.actor.add_child(headerBox);
        this._menu.addMenuItem(headerSection);

        // 2. Portfolio P&L Summary Banner
        this._summarySection = new PopupMenu.PopupMenuSection();
        this._summaryBox = new St.BoxLayout({
            vertical: true,
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
        this._symbolBox = new St.BoxLayout({ vertical: true, style_class: 'market-pulse-symbol-list' });
        this._symbolScroll.add_child(this._symbolBox);
        this._symbolListSection.actor.add_child(this._symbolScroll);
        this._menu.addMenuItem(this._symbolListSection);

        // 4. Detail View Card (Collapsible)
        this._detailSection = new PopupMenu.PopupMenuSection();
        this._detailView = new DetailView(this._registry);
        this._detailSection.actor.add_child(this._detailView);
        this._detailSection.actor.hide(); // Hidden until row selected
        this._menu.addMenuItem(this._detailSection);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 5. Bottom Settings Action Item (Section 3 A1 fix)
        const settingsItem = new PopupMenu.PopupMenuItem('⚙️  Extension Settings...');
        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this._menu.addMenuItem(settingsItem);
    }

    updateQuotes(quotesMap) {
        this._quotesMap = quotesMap;
        this.renderSymbolList();
    }

    renderSymbolList() {
        this._symbolBox.destroy_all_children();

        const portfolio = this._settings.getActivePortfolio();
        const symbols = portfolio.symbols;
        const isMasked = this._settings.get('hide-private-values');
        const isColorblind = this._settings.get('colorblind-mode');

        // Update Summary Banner
        const pSummary = PortfolioCalculator.calculatePortfolioSummary(portfolio, this._quotesMap, isMasked);
        if (pSummary.hasHoldings) {
            this._summarySection.actor.show();
            this._summaryValLabel.set_text(`Total Portfolio: ${PortfolioCalculator.formatValueOrMask(pSummary.totalValue, 'USD', isMasked)}`);
            this._summaryGainLabel.set_text(`P&L: ${PortfolioCalculator.formatValueOrMask(pSummary.totalGain, 'USD', isMasked)} (${Formatter.formatPercent(pSummary.totalGainPct)})`);
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
            const rowBox = new St.BoxLayout({ vertical: false, style_class: 'market-pulse-row-box' });

            // Symbol Name & Type
            const nameBox = new St.BoxLayout({ vertical: true, style_class: 'market-pulse-name-box' });
            const symLabel = new St.Label({ text: symObj.symbol, style_class: 'market-pulse-row-sym' });
            const descLabel = new St.Label({ text: symObj.name, style_class: 'market-pulse-row-desc' });
            nameBox.add_child(symLabel);
            nameBox.add_child(descLabel);
            rowBox.add_child(nameBox);

            // Mini Sparkline (Cairo)
            const sparkline = new Sparkline(54, 22, isColorblind);
            if (quote && quote.sparkline && quote.sparkline.length > 1) {
                sparkline.setPoints(quote.sparkline, quote.change >= 0);
            }
            rowBox.add_child(sparkline);

            // Price & Percent Chip
            const priceBox = new St.BoxLayout({ vertical: true, style_class: 'market-pulse-price-box' });
            const priceVal = quote ? Formatter.formatCurrency(quote.price, quote.currency) : '...';
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
        this._quotesMap = {};
        this._selectedSymbol = null;
    }
}
