/* Market Pulse — clipboard access (prefs process)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Gdk from 'gi://Gdk';

export function copyToClipboard(text) {
    try {
        const display = Gdk.Display.get_default();
        if (display) {
            display.get_clipboard().set(text);
            return true;
        }
    } catch (e) {
        console.error(`[market-pulse] Clipboard copy error: ${e.message}`);
    }
    return false;
}
