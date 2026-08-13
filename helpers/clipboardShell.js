/* Market Pulse — clipboard access (shell process)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import St from 'gi://St';

export function copyToClipboard(text) {
    try {
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
        return true;
    } catch (e) {
        console.error(`[market-pulse] Clipboard copy error: ${e.message}`);
        return false;
    }
}
