/**
 * Market Pulse — Formatter Helper
 * GPL-3.0 License
 */

let _fxService = null;
let _getDisplayCurrency = null;

export class Formatter {
    /**
     * Wires optional currency conversion (plan §C4). Called from enable() with
     * the FxService and a getter for the display-currency preference, and with
     * (null, null) on disable so nothing survives the extension.
     */
    static setFxService(fxService, displayCurrencyGetter) {
        _fxService = fxService;
        _getDisplayCurrency = displayCurrencyGetter;
    }

    /**
     * Converts into the user's display currency when a rate is already cached.
     * Rendering never awaits — an uncached rate simply shows the native amount.
     */
    static _convert(val, currency) {
        if (!_fxService || !_getDisplayCurrency) return [val, currency];
        const target = _getDisplayCurrency();
        if (!target || target === currency) return [val, currency];
        const rate = _fxService.getCachedRate(currency, target);
        return rate === null ? [val, currency] : [val * rate, target];
    }

    static formatCurrency(val, currency = 'USD', locale = undefined) {
        if (val === null || val === undefined || isNaN(val)) return '—';
        const [amount, code] = Formatter._convert(val, currency);
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: code,
                maximumFractionDigits: Math.abs(amount) >= 1 ? 2 : 4
            }).format(amount);
        } catch (e) {
            return `${code} ${amount.toFixed(2)}`;
        }
    }

    static formatNumber(val, decimals = 2) {
        if (val === null || val === undefined || isNaN(val)) return '—';
        if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
        if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
        if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
        if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
        return new Intl.NumberFormat(undefined, {
            maximumFractionDigits: decimals
        }).format(val);
    }

    static formatPercent(val) {
        if (val === null || val === undefined || isNaN(val)) return '—';
        const sign = val > 0 ? '+' : '';
        return `${sign}${val.toFixed(2)}%`;
    }

    static formatChangeAbs(val, currency = 'USD') {
        if (val === null || val === undefined || isNaN(val)) return '—';
        const sign = val > 0 ? '+' : '';
        return `${sign}${Formatter.formatCurrency(val, currency)}`;
    }

    static formatTime(timestamp) {
        if (!timestamp) return '—';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    static formatDate(dateString) {
        if (!dateString) return '—';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
}
