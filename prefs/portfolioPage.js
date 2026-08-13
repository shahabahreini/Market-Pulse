/**
 * Market Pulse — Preferences Portfolio Page
 * GPL-3.0 License
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import { ExportHelper } from '../helpers/export.js';
import { copyToClipboard } from '../helpers/clipboardPrefs.js';

/** Reads the quote cache the Shell process writes, so exports carry live prices. */
function loadCachedQuotes() {
    try {
        const path = GLib.build_filenamev([GLib.get_user_cache_dir(), 'market-pulse', 'quotes.json']);
        const file = Gio.File.new_for_path(path);
        if (!file.query_exists(null)) return {};
        const [ok, contents] = file.load_contents(null);
        if (!ok) return {};
        return JSON.parse(new TextDecoder().decode(contents)) || {};
    } catch (e) {
        console.warn(`[market-pulse] Could not read quote cache: ${e.message}`);
        return {};
    }
}

export const PortfolioPage = GObject.registerClass(
class PortfolioPage extends Adw.PreferencesPage {
    _init(settingsHelper) {
        super._init({
            title: 'Portfolios',
            icon_name: 'folder-saved-symbolic'
        });

        this._settingsHelper = settingsHelper;
        this._symbolRows = [];
        this._feedbackTimeoutIds = new Set();
        this._buildUi();

        this.connect('destroy', () => {
            for (const id of this._feedbackTimeoutIds) GLib.Source.remove(id);
            this._feedbackTimeoutIds.clear();
        });
    }

    /** Momentary button label feedback; the source is tracked so it can be removed. */
    _flashLabel(button, temporary, original) {
        button.set_label(temporary);
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            button.set_label(original);
            this._feedbackTimeoutIds.delete(id);
            return GLib.SOURCE_REMOVE;
        });
        this._feedbackTimeoutIds.add(id);
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
            this._settingsHelper.setBoolean('hide-private-values', maskRow.get_active());
        });
        privacyGroup.add(maskRow);

        const cbRow = new Adw.SwitchRow({
            title: 'Colorblind Safe Mode',
            subtitle: 'Use blue and orange colors for market gain/loss indicators',
            active: this._settingsHelper.get('colorblind-mode')
        });
        cbRow.connect('notify::active', () => {
            this._settingsHelper.setBoolean('colorblind-mode', cbRow.get_active());
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
            title: 'Backup, Import & Export',
            description: 'Portfolio holdings are stored locally and never leave this device'
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
            if (jsonText && copyToClipboard(jsonText)) {
                this._flashLabel(jsonBtn, 'Copied ✓', 'Copy JSON');
            }
        });
        exportJsonRow.add_suffix(jsonBtn);
        exportGroup.add(exportJsonRow);

        const exportCsvRow = new Adw.ActionRow({
            title: 'Copy Holdings CSV to Clipboard',
            subtitle: 'Export portfolio summary with last-known prices for spreadsheet analysis'
        });
        const csvBtn = new Gtk.Button({
            label: 'Copy CSV',
            valign: Gtk.Align.CENTER
        });
        csvBtn.connect('clicked', () => {
            const portfolio = this._settingsHelper.getActivePortfolio();
            const csvText = ExportHelper.exportHoldingsToCsv(portfolio, loadCachedQuotes());
            if (csvText && copyToClipboard(csvText)) {
                this._flashLabel(csvBtn, 'Copied ✓', 'Copy CSV');
            }
        });
        exportCsvRow.add_suffix(csvBtn);
        exportGroup.add(exportCsvRow);

        const importRow = new Adw.ActionRow({
            title: 'Import Portfolio from JSON',
            subtitle: 'Replaces the active portfolio with the contents of a backup file'
        });
        const importBtn = new Gtk.Button({
            label: 'Import…',
            valign: Gtk.Align.CENTER
        });
        importBtn.connect('clicked', () => this._onImportClicked());
        importRow.add_suffix(importBtn);
        exportGroup.add(importRow);

        this.add(exportGroup);
    }

    _onImportClicked() {
        const filter = new Gtk.FileFilter({ name: 'JSON portfolio' });
        filter.add_mime_type('application/json');
        filter.add_pattern('*.json');

        const dialog = new Gtk.FileDialog({
            title: 'Import Market Pulse Portfolio',
            filters: Gio.ListStore.new(Gtk.FileFilter)
        });
        dialog.get_filters().append(filter);

        dialog.open(this.get_root(), null, (source, result) => {
            let file;
            try {
                file = source.open_finish(result);
            } catch (e) {
                return; // User dismissed the chooser.
            }
            this._importFromFile(file);
        });
    }

    _importFromFile(file) {
        file.load_contents_async(null, (source, result) => {
            try {
                const [ok, contents] = source.load_contents_finish(result);
                if (!ok) throw new Error('Could not read file');

                const parsed = ExportHelper.parsePortfolioJson(new TextDecoder().decode(contents));
                const portfolios = this._settingsHelper.getPortfolios();
                const activeId = this._settingsHelper.get('active-portfolio') || 'default';

                portfolios[activeId] = {
                    ...parsed,
                    id: activeId
                };
                this._settingsHelper.savePortfolios(portfolios);
                this.refreshSymbolsList();
                this._toast(`Imported ${parsed.symbols.length} symbols`);
            } catch (e) {
                console.error(`[market-pulse] Portfolio import failed: ${e.message}`);
                this._toast(`Import failed: ${e.message}`);
            }
        });
    }

    _toast(message) {
        const root = this.get_root();
        if (root && typeof root.add_toast === 'function') {
            root.add_toast(new Adw.Toast({ title: message }));
        }
    }

    refreshSymbolsList() {
        const portfolio = this._settingsHelper.getActivePortfolio();

        // Adw.PreferencesGroup is not a Gtk.Container — track rows to remove them.
        for (const row of this._symbolRows) {
            this._symbolsGroup.remove(row);
        }
        this._symbolRows = [];

        if (!portfolio.symbols || portfolio.symbols.length === 0) {
            const emptyRow = new Adw.ActionRow({
                title: 'No symbols in active portfolio',
                subtitle: 'Use the "+" button in the panel menu to add stocks or crypto'
            });
            this._symbolsGroup.add(emptyRow);
            this._symbolRows.push(emptyRow);
            return;
        }

        for (const symObj of portfolio.symbols) {
            const holding = portfolio.holdings[symObj.symbol] || { quantity: 0, buyPrice: 0 };

            const expRow = new Adw.ExpanderRow({
                title: `${symObj.symbol} — ${symObj.name}`,
                subtitle: this._holdingSubtitle(holding.quantity, holding.buyPrice)
            });

            const updateHolding = (mutate) => {
                const portfolios = this._settingsHelper.getPortfolios();
                const activeId = this._settingsHelper.get('active-portfolio') || 'default';
                const target = portfolios[activeId];
                if (!target) return;
                if (!target.holdings[symObj.symbol]) {
                    target.holdings[symObj.symbol] = { symbol: symObj.symbol, quantity: 0, buyPrice: 0 };
                }
                mutate(target.holdings[symObj.symbol]);
                this._settingsHelper.savePortfolios(portfolios);
                const h = target.holdings[symObj.symbol];
                expRow.set_subtitle(this._holdingSubtitle(h.quantity, h.buyPrice));
            };

            const qtyRow = new Adw.SpinRow({
                title: 'Quantity (Shares / Units)',
                digits: 4,
                adjustment: new Gtk.Adjustment({
                    lower: 0,
                    upper: 1000000,
                    step_increment: 1,
                    value: holding.quantity
                })
            });
            qtyRow.connect('notify::value', () => {
                updateHolding(h => { h.quantity = qtyRow.get_value(); });
            });
            expRow.add_row(qtyRow);

            const priceRow = new Adw.SpinRow({
                title: 'Purchase Price / Cost Basis',
                digits: 2,
                adjustment: new Gtk.Adjustment({
                    lower: 0,
                    upper: 1000000,
                    step_increment: 0.01,
                    value: holding.buyPrice
                })
            });
            priceRow.connect('notify::value', () => {
                updateHolding(h => { h.buyPrice = priceRow.get_value(); });
            });
            expRow.add_row(priceRow);

            const delBtn = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: `Remove ${symObj.symbol}`,
                css_classes: ['flat']
            });
            delBtn.connect('clicked', () => this._confirmRemove(symObj));
            expRow.add_suffix(delBtn);

            this._symbolsGroup.add(expRow);
            this._symbolRows.push(expRow);
        }
    }

    _holdingSubtitle(quantity, buyPrice) {
        return `Holdings: ${Number(quantity) || 0} @ ${(Number(buyPrice) || 0).toFixed(2)}`;
    }

    /** Adw.AlertDialog for destructive actions, per GNOME HIG (plan §0.6.1). */
    _confirmRemove(symObj) {
        const dialog = new Adw.AlertDialog({
            heading: `Remove ${symObj.symbol}?`,
            body: `${symObj.name} and its recorded holdings will be removed from this portfolio.`
        });
        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('remove', 'Remove');
        dialog.set_response_appearance('remove', Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.set_default_response('cancel');
        dialog.set_close_response('cancel');

        dialog.connect('response', (_d, response) => {
            if (response !== 'remove') return;
            this._settingsHelper.removeSymbolFromActivePortfolio(symObj.symbol);
            this.refreshSymbolsList();
        });

        dialog.present(this.get_root());
    }
});
