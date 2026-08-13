/* Market Pulse — first-run dialog
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { SymbolData } from '../helpers/models.js';
import { PRESETS } from '../helpers/presets.js';

export const OnboardingDialog = GObject.registerClass(
class OnboardingDialog extends ModalDialog.ModalDialog {
    _init(settingsHelper, onFinished) {
        super._init({ styleClass: 'market-pulse-onboarding-dialog' });

        this._settings = settingsHelper;
        this._onFinished = onFinished;

        this.connect('closed', () => this.destroy());

        const content = this.contentLayout;
        content.set_style('width: 460px; padding: 20px;');

        content.add_child(new St.Label({
            text: 'Welcome to Market Pulse',
            style_class: 'market-pulse-dialog-title'
        }));

        content.add_child(new St.Label({
            text: 'Track live stock and crypto prices right in your top bar.\n' +
                  'Pick a starter list below — you can add, rename or remove anything later.',
            style_class: 'market-pulse-onboarding-body'
        }));

        const list = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'market-pulse-onboarding-list'
        });

        for (const preset of PRESETS) {
            const btn = new St.Button({
                style_class: 'button market-pulse-preset-row',
                accessible_name: `Start with ${preset.label}`,
                x_expand: true,
                can_focus: true
            });

            const box = new St.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                style_class: 'market-pulse-preset-box'
            });
            box.add_child(new St.Label({
                text: preset.label,
                style_class: 'market-pulse-preset-title'
            }));
            box.add_child(new St.Label({
                text: preset.description,
                style_class: 'market-pulse-preset-desc'
            }));
            btn.set_child(box);

            btn.connect('clicked', () => this._finish(preset.symbols));
            list.add_child(btn);
        }
        content.add_child(list);

        this.addButton({
            label: 'Start Empty',
            action: () => this._finish(null),
            key: Clutter.KEY_Escape
        });
    }

    /** `symbols` null means an explicit empty start. */
    _finish(symbols) {
        try {
            // The schema ships a default watchlist, so the choice made here
            // replaces it rather than adding to it.
            const portfolios = this._settings.getPortfolios();
            const activeId = this._settings.get('active-portfolio') || 'default';
            if (portfolios[activeId]) {
                portfolios[activeId].symbols = [];
                this._settings.savePortfolios(portfolios);
            }

            for (const s of symbols ?? []) {
                this._settings.addSymbolToActivePortfolio(new SymbolData(s));
            }
            this._settings.setBoolean('first-run-complete', true);
        } catch (e) {
            console.error(`[market-pulse] Onboarding error: ${e.message}`);
        }

        const finished = this._onFinished;
        this._onFinished = null;
        this.close();
        finished?.(!!symbols);
    }

    destroy() {
        // Both the 'closed' handler and _finish()'s close() reach this.
        if (this._destroyed) return;
        this._destroyed = true;

        this._onFinished = null;
        super.destroy();
    }
});
