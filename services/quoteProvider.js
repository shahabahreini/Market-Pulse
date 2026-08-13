/**
 * Market Pulse — Base QuoteProvider Interface & Provider Registry
 * GPL-3.0 License
 */

import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';

export class BaseQuoteProvider {
    constructor(id, name, assetClasses = []) {
        this.id = id;
        this.name = name;
        this.assetClasses = assetClasses; // e.g. ['equity', 'crypto', 'forex']
        this._session = new Soup.Session();
        this._session.user_agent = 'Market-Pulse-GNOME-Extension/1.0';
    }

    async fetchQuotes(symbols, cancellable = null) {
        throw new Error('fetchQuotes() must be implemented by subclass');
    }

    async searchSymbols(query, cancellable = null) {
        return [];
    }

    async fetchChartData(symbol, range = '1d', interval = '5m', cancellable = null) {
        return [];
    }

    async _httpGetJson(url, headers = {}, cancellable = null) {
        try {
            const uri = GLib.Uri.parse(url, GLib.UriFlags.NONE);
            const msg = Soup.Message.new_from_uri('GET', uri);
            for (const [k, v] of Object.entries(headers)) {
                msg.request_headers.append(k, v);
            }

            const bytes = await this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, cancellable);
            if (!bytes) return null;

            const statusCode = msg.get_status();
            if (statusCode !== 200) {
                console.warn(`[market-pulse] ${this.name} HTTP ${statusCode} for ${url}`);
                if (statusCode === 429) {
                    const err = new Error('Rate limit exceeded (HTTP 429)');
                    err.statusCode = 429;
                    throw err;
                }
                return null;
            }

            const data = bytes.get_data();
            if (!data) return null;
            const text = new TextDecoder('utf-8').decode(data);
            return JSON.parse(text);
        } catch (e) {
            if (e.matches && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                return null;
            }
            throw e;
        }
    }

    cancelAllRequests() {
        if (this._session) {
            this._session.abort();
        }
    }

    destroy() {
        this.cancelAllRequests();
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

    destroy() {
        for (const p of this._providers.values()) {
            p.destroy();
        }
        this._providers.clear();
    }
}
