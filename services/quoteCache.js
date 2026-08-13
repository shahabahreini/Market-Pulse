/**
 * Market Pulse — Quote Cache & Offline Persistence
 *
 * All disk access is asynchronous: the plan forbids blocking the Shell's main
 * loop on file I/O. The only exception is the final flush in destroy(), where
 * the extension is being torn down and there is no later turn to complete in.
 *
 * GPL-3.0 License
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { Quote } from '../helpers/models.js';

Gio._promisify(Gio.File.prototype, 'load_contents_async');
Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');

export class QuoteCache {
    constructor() {
        this._memoryCache = new Map();
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'market-pulse']);
        this._cacheFile = GLib.build_filenamev([this._cacheDir, 'quotes.json']);
        this._saveTimeoutId = null;
        this._destroyed = false;

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

    _serialize() {
        const data = {};
        for (const [sym, quote] of this._memoryCache.entries()) {
            data[sym] = quote;
        }
        return new TextEncoder().encode(JSON.stringify(data));
    }

    _scheduleDiskSave() {
        if (this._saveTimeoutId || this._destroyed) return;
        this._saveTimeoutId = GLib.timeout_add(GLib.PRIORITY_LOW, 2000, () => {
            this._saveTimeoutId = null;
            this._saveToDisk().catch(e => {
                console.error(`[market-pulse] Error writing quote cache: ${e.message}`);
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    async _saveToDisk() {
        const file = Gio.File.new_for_path(this._cacheFile);
        await file.replace_contents_bytes_async(
            new GLib.Bytes(this._serialize()),
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
        );
    }

    async _loadFromDisk() {
        try {
            const file = Gio.File.new_for_path(this._cacheFile);
            const [contents] = await file.load_contents_async(null);
            const data = JSON.parse(new TextDecoder().decode(contents));

            for (const [sym, qObj] of Object.entries(data)) {
                // Do not clobber a live quote that arrived while we were reading.
                if (this._memoryCache.has(sym)) continue;
                this._memoryCache.set(sym, new Quote(qObj));
            }
        } catch (e) {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                console.warn(`[market-pulse] Error reading quote cache: ${e.message}`);
            }
        }
    }

    destroy() {
        this._destroyed = true;
        if (this._saveTimeoutId) {
            GLib.Source.remove(this._saveTimeoutId);
            this._saveTimeoutId = null;
        }

        // Final flush during teardown — nothing else will run to complete it.
        try {
            Gio.File.new_for_path(this._cacheFile).replace_contents(
                this._serialize(),
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
        } catch (e) {
            console.error(`[market-pulse] Error flushing quote cache: ${e.message}`);
        }

        this._memoryCache.clear();
    }
}
