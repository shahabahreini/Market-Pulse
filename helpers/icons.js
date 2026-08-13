/* Market Pulse — icon lookup
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Gio from 'gi://Gio';

const SYMBOLIC_NAME = 'market-pulse-symbolic';

/**
 * Returns the panel icon as a GIcon.
 *
 * Referencing the icon by name alone only works when the extension's icons
 * directory has been appended to the GTK icon theme search path, which is not
 * something an extension can rely on. Resolving the file by absolute path
 * always works, so that is the primary route and the themed name is the
 * fallback for installs where the file is missing.
 */
export function symbolicGIcon(extensionPath) {
    try {
        const file = Gio.File.new_for_path(
            `${extensionPath}/icons/hicolor/scalable/actions/${SYMBOLIC_NAME}.svg`
        );
        if (file.query_exists(null)) return new Gio.FileIcon({ file });
    } catch (e) {
        console.warn(`[market-pulse] Icon lookup failed: ${e.message}`);
    }
    return new Gio.ThemedIcon({ name: SYMBOLIC_NAME });
}
