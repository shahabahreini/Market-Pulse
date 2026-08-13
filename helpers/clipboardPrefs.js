/**
 * Market Pulse — Clipboard shim for the preferences (GTK) process.
 * Only imported from prefs.js and prefs/*.js — never from extension.js.
 * GPL-3.0 License
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
