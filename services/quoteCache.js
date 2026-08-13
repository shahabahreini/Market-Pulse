/**
 * Market Pulse — Quote Cache & Offline Persistence
 * GPL-3.0 License
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Quote } from '../helpers/models.js';

export class QuoteCache {
    constructor() {
        this._memoryCache = new Map();
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'market-pulse']);
        this._cacheFile = GLib.build_filenamev([this._cacheDir, 'quotes.json']);
        this._ensureCacheDir();
        this._loadFromDisk();
    }

    _ensureCacheDir() {
        try {
            GLib.mkdir_with_parents(this._cacheDir, 0o755);
        } catch (e) {
            console.error(`[market-pulse] Failed to create cache directory: ${e.message}`);
        }
    }

    set(symbol, quote) {
        this._memoryCache.set(symbol, quote);
        this._scheduleDiskSave();
    }

    setMultiple(quotesMap) {
        for (const [sym, quote] of Object.entries(quotesMap)) {
            this._memoryCache.set(sym, quote);
        }
        this._scheduleDiskSave();
    }

    get(symbol) {
        return this._memoryCache.get(symbol) || null;
    }

    getAll() {
        const obj = {};
        for (const [sym, quote] of this._memoryCache.entries()) {
            obj[sym] = quote;
        }
        return obj;
    }

    _scheduleDiskSave() {
        if (this._saveTimeoutId) return;
        this._saveTimeoutId = GLib.timeout_add(GLib.PRIORITY_LOW, 2000, () => {
            this._saveToDisk();
            this._saveTimeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _saveToDisk() {
        try {
            const data = {};
            for (const [sym, quote] of this._memoryCache.entries()) {
                data[sym] = quote;
            }
            const file = Gio.File.new_for_path(this._cacheFile);
            file.replace_contents(
                new TextEncoder().encode(JSON.stringify(data)),
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
        } catch (e) {
            console.error(`[market-pulse] Error writing quote cache to disk: ${e.message}`);
        }
    }

    _loadFromDisk() {
        try {
            const file = Gio.File.new_for_path(this._cacheFile);
            if (!file.query_exists(null)) return;
            const [success, contents] = file.load_contents(null);
            if (success) {
                const text = new TextDecoder().decode(contents);
                const data = JSON.parse(text);
                for (const [sym, qObj] of Object.entries(data)) {
                    this._memoryCache.set(sym, new Quote(qObj));
                }
            }
        } catch (e) {
            console.warn(`[market-pulse] Error reading quote cache from disk: ${e.message}`);
        }
    }

    destroy() {
        if (this._saveTimeoutId) {
            GLib.Source.remove(this._saveTimeoutId);
            this._saveTimeoutId = null;
        }
        this._saveToDisk();
        this._memoryCache.clear();
    }
}
