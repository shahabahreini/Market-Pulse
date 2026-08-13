/**
 * Market Pulse — Clipboard shim for the gnome-shell process.
 * Only St is available here; Gtk/Gdk must never be imported.
 * GPL-3.0 License
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
