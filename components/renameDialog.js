/* Market Pulse — symbol nickname dialog
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export const RenameDialog = GObject.registerClass(
class RenameDialog extends ModalDialog.ModalDialog {
    _init(symbolObj, settingsHelper, onRenamed) {
        super._init({ styleClass: 'market-pulse-search-dialog' });

        this._settings = settingsHelper;
        this._symbol = symbolObj;
        this._onRenamed = onRenamed;

        this.connect('closed', () => this.destroy());

        const content = this.contentLayout;
        content.set_style('width: 380px; padding: 16px;');

        content.add_child(new St.Label({
            text: `Rename ${symbolObj.symbol}`,
            style_class: 'market-pulse-dialog-title'
        }));

        content.add_child(new St.Label({
            text: `Shown in the top bar instead of "${symbolObj.name}". Leave empty to use the full name.`,
            style_class: 'market-pulse-onboarding-body'
        }));

        this._entry = new St.Entry({
            hint_text: 'Short name',
            style_class: 'market-pulse-search-entry',
            can_focus: true
        });
        this._entry.set_text(symbolObj.nickname || '');
        content.add_child(this._entry);

        this._entry.clutter_text.connect('activate', () => this._apply());

        this.addButton({
            label: 'Cancel',
            action: () => this.close(),
            key: Clutter.KEY_Escape
        });
        this.addButton({
            label: 'Save',
            action: () => this._apply(),
            default: true
        });

        this.setInitialKeyFocus(this._entry.clutter_text);
    }

    _apply() {
        const nickname = this._entry.get_text().trim();
        this._settings.setSymbolNickname(this._symbol.symbol, nickname);

        const done = this._onRenamed;
        this._onRenamed = null;
        this.close();
        done?.(nickname);
    }

    destroy() {
        // Reached from both the 'closed' handler and _apply()'s close().
        if (this._destroyed) return;
        this._destroyed = true;

        this._onRenamed = null;
        this._entry = null;
        this._symbol = null;
        super.destroy();
    }
});
