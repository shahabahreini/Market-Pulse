/**
 * Market Pulse — First-Run Onboarding (plan §C13)
 *
 * Shown once, gated on the first-run-complete setting. Offers a demo portfolio
 * so a new user reaches live data in well under 30 seconds.
 *
 * GPL-3.0 License
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { SymbolData } from '../helpers/models.js';

const DEMO_SYMBOLS = [
    { symbol: '^GSPC', name: 'S&P 500', type: 'index', provider: 'yahoo' },
    { symbol: '^IXIC', name: 'NASDAQ Composite', type: 'index', provider: 'yahoo' },
    { symbol: 'BTC-USD', name: 'Bitcoin USD', type: 'crypto', provider: 'yahoo' }
];

export const OnboardingDialog = GObject.registerClass(
class OnboardingDialog extends ModalDialog.ModalDialog {
    _init(settingsHelper, onFinished) {
        super._init({ styleClass: 'market-pulse-onboarding-dialog' });

        this._settings = settingsHelper;
        this._onFinished = onFinished;

        this.connect('closed', () => this.destroy());

        const content = this.contentLayout;
        content.set_style('width: 420px; padding: 20px;');

        content.add_child(new St.Label({
            text: 'Welcome to Market Pulse',
            style_class: 'market-pulse-dialog-title'
        }));

        content.add_child(new St.Label({
            text: 'Track live stock and crypto quotes right in your top bar.\n' +
                  'Start with a demo portfolio, or add your own symbols with the “+” button in the menu.',
            style_class: 'market-pulse-onboarding-body'
        }));

        const list = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'market-pulse-onboarding-list'
        });
        for (const s of DEMO_SYMBOLS) {
            list.add_child(new St.Label({
                text: `• ${s.symbol} — ${s.name}`,
                style_class: 'market-pulse-onboarding-item'
            }));
        }
        content.add_child(list);

        this.addButton({
            label: 'Start Empty',
            action: () => this._finish(false),
            key: Clutter.KEY_Escape
        });
        this.addButton({
            label: 'Add Demo Portfolio',
            action: () => this._finish(true),
            default: true
        });
    }

    _finish(useDemo) {
        try {
            if (useDemo) {
                for (const s of DEMO_SYMBOLS) {
                    this._settings.addSymbolToActivePortfolio(new SymbolData(s));
                }
            } else {
                // Explicit empty start: clear the schema's default symbols.
                const portfolios = this._settings.getPortfolios();
                const activeId = this._settings.get('active-portfolio') || 'default';
                if (portfolios[activeId]) {
                    portfolios[activeId].symbols = [];
                    this._settings.savePortfolios(portfolios);
                }
            }
            this._settings.setBoolean('first-run-complete', true);
        } catch (e) {
            console.error(`[market-pulse] Onboarding error: ${e.message}`);
        }

        const finished = this._onFinished;
        this._onFinished = null;
        this.close();
        finished?.(useDemo);
    }

    destroy() {
        this._onFinished = null;
        super.destroy();
    }
});
