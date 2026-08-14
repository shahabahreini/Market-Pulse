/* Market Pulse — clipboard access (shell process)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from 'gi://St';

export function copyToClipboard(text) {
    try {
        // Called only by the detail view's explicit Copy button. This writes
        // user-visible text and never reads or shares clipboard contents.
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
        return true;
    } catch {
        return false;
    }
}
