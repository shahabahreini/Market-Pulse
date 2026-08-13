/**
 * Market Pulse — Preferences Portfolio Page
 * GPL-3.0 License
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import { ExportHelper } from '../helpers/export.js';

export const PortfolioPage = GObject.registerClass(
class PortfolioPage extends Adw.PreferencesPage {
    _init(settingsHelper) {
        super._init({
            title: 'Portfolios',
            icon_name: 'folder-saved-symbolic'
        });

        this._settingsHelper = settingsHelper;
        this._buildUi();
    }

    _buildUi() {
        // --- Group 1: Display & Privacy ---
        const privacyGroup = new Adw.PreferencesGroup({
            title: 'Display & Privacy Options',
            description: 'Mask portfolio values for screen sharing'
        });

        const maskRow = new Adw.SwitchRow({
            title: 'Mask Portfolio Values',
            subtitle: 'Hide total holdings and P&L amounts in UI',
            active: this._settingsHelper.get('hide-private-values')
        });
        maskRow.connect('notify::active', () => {
            this._settingsHelper.set('hide-private-values', new GObject.Value(maskRow.get_active()));
        });
        privacyGroup.add(maskRow);

        const cbRow = new Adw.SwitchRow({
            title: 'Colorblind Safe Mode',
            subtitle: 'Use blue and orange colors for market gain/loss indicators',
            active: this._settingsHelper.get('colorblind-mode')
        });
        cbRow.connect('notify::active', () => {
            this._settingsHelper.set('colorblind-mode', new GObject.Value(cbRow.get_active()));
        });
        privacyGroup.add(cbRow);

        this.add(privacyGroup);

        // --- Group 2: Interactive Symbol Holdings & Cost Basis Editor ---
        this._symbolsGroup = new Adw.PreferencesGroup({
            title: 'Tracked Symbols & Cost Basis (P&L)',
            description: 'Enter your shares quantity and buy price to track real-time position profit & loss'
        });

        this.refreshSymbolsList();
        this.add(this._symbolsGroup);

        // --- Group 3: Data Import & Export ---
        const exportGroup = new Adw.PreferencesGroup({
            title: 'Backup & Data Export',
            description: 'Export portfolio holdings to JSON or CSV formats'
        });

        const exportJsonRow = new Adw.ActionRow({
            title: 'Copy Portfolio JSON to Clipboard',
            subtitle: 'Backup your tracked symbols and holdings cost basis'
        });
        const jsonBtn = new Gtk.Button({
            label: 'Copy JSON',
            valign: Gtk.Align.CENTER
        });
        jsonBtn.connect('clicked', () => {
            const portfolio = this._settingsHelper.getActivePortfolio();
            const jsonText = ExportHelper.exportPortfolioToJson(portfolio);
            if (jsonText && ExportHelper.copyToClipboard(jsonText)) {
                jsonBtn.set_label('Copied! ✓');
                Gtk.timeout_add(0, 2000, () => {
                    jsonBtn.set_label('Copy JSON');
                    return false;
                });
            }
        });
        exportJsonRow.add_suffix(jsonBtn);
        exportGroup.add(exportJsonRow);

        const exportCsvRow = new Adw.ActionRow({
            title: 'Copy Holdings CSV to Clipboard',
            subtitle: 'Export portfolio summary for spreadsheet analysis'
        });
        const csvBtn = new Gtk.Button({
            label: 'Copy CSV',
            valign: Gtk.Align.CENTER
        });
        csvBtn.connect('clicked', () => {
            const portfolio = this._settingsHelper.getActivePortfolio();
            const csvText = ExportHelper.exportHoldingsToCsv(portfolio);
            if (csvText && ExportHelper.copyToClipboard(csvText)) {
                csvBtn.set_label('Copied! ✓');
                Gtk.timeout_add(0, 2000, () => {
                    csvBtn.set_label('Copy CSV');
                    return false;
                });
            }
        });
        exportCsvRow.add_suffix(csvBtn);
        exportGroup.add(exportCsvRow);

        this.add(exportGroup);
    }

    refreshSymbolsList() {
        const portfolio = this._settingsHelper.getActivePortfolio();

        for (const child of this._symbolsGroup.get_children()) {
            this._symbolsGroup.remove(child);
        }

        if (!portfolio.symbols || portfolio.symbols.length === 0) {
            const emptyRow = new Adw.ActionRow({
                title: 'No symbols in active portfolio',
                subtitle: 'Use the top bar "+" button to add stocks or crypto'
            });
            this._symbolsGroup.add(emptyRow);
            return;
        }

        for (const symObj of portfolio.symbols) {
            const holding = portfolio.holdings[symObj.symbol] || { quantity: 0, buyPrice: 0 };

            const expRow = new Adw.ExpanderRow({
                title: `${symObj.symbol} — ${symObj.name}`,
                subtitle: `Holdings: ${holding.quantity} shares @ $${holding.buyPrice.toFixed(2)}`
            });

            // Quantity SpinRow
            const qtyRow = new Adw.SpinRow({
                title: 'Quantity (Shares / Units)',
                adjustment: new Gtk.Adjustment({
                    lower: 0,
                    upper: 1000000,
                    step_increment: 1,
                    value: holding.quantity
                })
            });
            qtyRow.connect('notify::value', () => {
                const portfolios = this._settingsHelper.getPortfolios();
                const activeId = this._settingsHelper.get('active-portfolio') || 'default';
                if (portfolios[activeId]) {
                    if (!portfolios[activeId].holdings[symObj.symbol]) {
                        portfolios[activeId].holdings[symObj.symbol] = { symbol: symObj.symbol, quantity: 0, buyPrice: 0 };
                    }
                    portfolios[activeId].holdings[symObj.symbol].quantity = qtyRow.get_value();
                    this._settingsHelper.savePortfolios(portfolios);
                    expRow.set_subtitle(`Holdings: ${qtyRow.get_value()} shares @ $${portfolios[activeId].holdings[symObj.symbol].buyPrice.toFixed(2)}`);
                }
            });
            expRow.add_row(qtyRow);

            // Buy Price SpinRow
            const priceRow = new Adw.SpinRow({
                title: 'Purchase Price / Cost Basis ($)',
                digits: 2,
                adjustment: new Gtk.Adjustment({
                    lower: 0,
                    upper: 1000000,
                    step_increment: 0.01,
                    value: holding.buyPrice
                })
            });
            priceRow.connect('notify::value', () => {
                const portfolios = this._settingsHelper.getPortfolios();
                const activeId = this._settingsHelper.get('active-portfolio') || 'default';
                if (portfolios[activeId]) {
                    if (!portfolios[activeId].holdings[symObj.symbol]) {
                        portfolios[activeId].holdings[symObj.symbol] = { symbol: symObj.symbol, quantity: 0, buyPrice: 0 };
                    }
                    portfolios[activeId].holdings[symObj.symbol].buyPrice = priceRow.get_value();
                    this._settingsHelper.savePortfolios(portfolios);
                    expRow.set_subtitle(`Holdings: ${portfolios[activeId].holdings[symObj.symbol].quantity} shares @ $${priceRow.get_value().toFixed(2)}`);
                }
            });
            expRow.add_row(priceRow);

            // Remove Button Action
            const delBtn = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['destructive-action']
            });
            delBtn.connect('clicked', () => {
                this._settingsHelper.removeSymbolFromActivePortfolio(symObj.symbol);
                this.refreshSymbolsList();
            });
            expRow.add_suffix(delBtn);

            this._symbolsGroup.add(expRow);
        }
    }
});
