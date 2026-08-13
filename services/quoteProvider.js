/**
 * Market Pulse — Base QuoteProvider Interface & Provider Registry
 * GPL-3.0 License
 */

import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// GJS does not auto-promisify Soup; without this every await returns undefined.
Gio._promisify(Soup.Session.prototype, 'send_and_read_async');

let _sharedSession = null;

/** One Soup.Session for the whole extension (plan §A5). */
export function getSharedSession() {
    if (!_sharedSession) {
        _sharedSession = new Soup.Session({ timeout: 15 });
        _sharedSession.user_agent = USER_AGENT;
    }
    return _sharedSession;
}

export function destroySharedSession() {
    if (_sharedSession) {
        _sharedSession.abort();
        _sharedSession = null;
    }
}

/**
 * Soup.Message.get_status() marshals into the Soup.Status enum and *throws*
 * for codes absent from it (429 among them). Recover the numeric code instead
 * of letting the exception masquerade as a network failure.
 */
export function readStatus(msg) {
    try {
        return msg.get_status();
    } catch (e) {
        const fromError = /^(\d{3})\b/.exec(e.message);
        if (fromError) return Number(fromError[1]);
        return /too many requests/i.test(msg.get_reason_phrase() ?? '') ? 429 : 0;
    }
}

export class BaseQuoteProvider {
    constructor(id, name, assetClasses = []) {
        this.id = id;
        this.name = name;
        this.assetClasses = assetClasses; // e.g. ['equity', 'crypto', 'forex']
    }

    get _session() {
        return getSharedSession();
    }

    // Interface stubs. Adapters override what they support; the defaults let
    // callers probe capabilities without feature-testing every provider.
    async fetchQuotes(_symbols, _cancellable = null) {
        throw new Error('fetchQuotes() must be implemented by subclass');
    }

    async searchSymbols(_query, _cancellable = null) {
        return [];
    }

    async fetchChartData(_symbol, _range = '1d', _interval = '5m', _cancellable = null) {
        return [];
    }

    async _httpGetText(url, headers = {}, cancellable = null) {
        try {
            const uri = GLib.Uri.parse(url, GLib.UriFlags.NONE);
            const msg = Soup.Message.new_from_uri('GET', uri);
            for (const [k, v] of Object.entries(headers)) {
                msg.request_headers.append(k, v);
            }

            const bytes = await this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, cancellable);
            if (!bytes) return null;

            const statusCode = readStatus(msg);
            if (statusCode !== 200) {
                // Never log the full URL — it may carry query parameters.
                console.warn(`[market-pulse] ${this.name} HTTP ${statusCode}`);
                if (statusCode === 429 || statusCode === 503) {
                    const err = new Error(`Rate limited (HTTP ${statusCode})`);
                    err.statusCode = statusCode;
                    throw err;
                }
                return null;
            }

            const data = bytes.get_data();
            if (!data) return null;
            return new TextDecoder('utf-8').decode(data);
        } catch (e) {
            if (e.matches && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                return null;
            }
            throw e;
        }
    }

    async _httpGetJson(url, headers = {}, cancellable = null) {
        const text = await this._httpGetText(url, headers, cancellable);
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error(`[market-pulse] JSON parse error from ${this.name}: ${e.message}`);
            return null;
        }
    }

    destroy() {
        // The Soup session is shared and torn down once by the registry.
    }
}

export class ProviderRegistry {
    constructor() {
        this._providers = new Map();
    }

    register(provider) {
        this._providers.set(provider.id, provider);
    }

    getProvider(id) {
        return this._providers.get(id);
    }

    getEnabledProviders(enabledIds = ['yahoo', 'eastmoney']) {
        const result = [];
        for (const id of enabledIds) {
            if (this._providers.has(id)) {
                result.push(this._providers.get(id));
            }
        }
        return result.length > 0 ? result : Array.from(this._providers.values());
    }

    /**
     * Providers that declare support for a symbol's asset class, ordered by the
     * user's enabled list — the failover chain for that symbol (plan §C8).
     */
    getChainForSymbol(symbolObj, enabledIds) {
        const chain = [];
        const preferred = symbolObj?.provider;
        if (preferred && this._providers.has(preferred) && enabledIds.includes(preferred)) {
            chain.push(this._providers.get(preferred));
        }
        const assetClass = symbolObj?.type || 'equity';
        for (const provider of this.getEnabledProviders(enabledIds)) {
            if (chain.includes(provider)) continue;
            if (provider.assetClasses.length === 0 || provider.assetClasses.includes(assetClass)) {
                chain.push(provider);
            }
        }
        return chain;
    }

    destroy() {
        for (const p of this._providers.values()) {
            p.destroy();
        }
        this._providers.clear();
        destroySharedSession();
    }
}
