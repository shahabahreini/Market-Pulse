/* Market Pulse — destructive action confirmation
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export const ConfirmDialog = GObject.registerClass(
class ConfirmDialog extends ModalDialog.ModalDialog {
    _init({ heading, body, confirmLabel = 'Remove' }, onConfirm) {
        super._init({ styleClass: 'market-pulse-search-dialog' });

        this._onConfirm = onConfirm;
        this.connect('closed', () => this.destroy());

        const content = this.contentLayout;
        content.set_style('width: 380px; padding: 16px;');

        content.add_child(new St.Label({
            text: heading,
            style_class: 'market-pulse-dialog-title'
        }));
        content.add_child(new St.Label({
            text: body,
            style_class: 'market-pulse-onboarding-body'
        }));

        this.addButton({
            label: 'Cancel',
            action: () => this.close(),
            key: Clutter.KEY_Escape,
            default: true
        });
        this.addButton({
            label: confirmLabel,
            action: () => {
                const confirmed = this._onConfirm;
                this._onConfirm = null;
                this.close();
                confirmed?.();
            }
        });
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        this._onConfirm = null;
        super.destroy();
    }
});
