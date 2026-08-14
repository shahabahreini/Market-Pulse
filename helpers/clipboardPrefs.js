/* Market Pulse — clipboard access (prefs process)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Gdk from 'gi://Gdk';

export function copyToClipboard(text) {
    try {
        // Called only by explicit export Copy buttons; clipboard data is never
        // read or shared outside the local desktop session.
        const display = Gdk.Display.get_default();
        if (display) {
            display.get_clipboard().set(text);
            return true;
        }
    } catch {}
    return false;
}
