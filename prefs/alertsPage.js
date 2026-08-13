/**
 * Market Pulse — Preferences Alerts Page
 * GPL-3.0 License
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import { AlertRule } from '../helpers/models.js';

export const AlertsPage = GObject.registerClass(
class AlertsPage extends Adw.PreferencesPage {
    _init(settingsHelper) {
        super._init({
            title: 'Alerts',
            icon_name: 'preferences-system-notifications-symbolic'
        });

        this._settingsHelper = settingsHelper;
        this._buildUi();
    }

    _buildUi() {
        // --- Group 1: General Notification Settings ---
        const group = new Adw.PreferencesGroup({
            title: 'Session-Bound Price Alerts',
            description: 'Notifications fire only while GNOME extension is active. No background daemons or audio.'
        });

        const alertSwitch = new Adw.SwitchRow({
            title: 'Enable Price Notifications',
            subtitle: 'Notify on target prices and daily surge/decline thresholds',
            active: this._settingsHelper.get('alerts-enabled')
        });
        alertSwitch.connect('notify::active', () => {
            this._settingsHelper.set('alerts-enabled', new GObject.Value(alertSwitch.get_active()));
        });
        group.add(alertSwitch);

        const quietSwitch = new Adw.SwitchRow({
            title: 'Enable Quiet Hours',
            subtitle: 'Suppress alert notifications between 22:00 and 07:00',
            active: this._settingsHelper.get('quiet-hours-enabled')
        });
        quietSwitch.connect('notify::active', () => {
            this._settingsHelper.set('quiet-hours-enabled', new GObject.Value(quietSwitch.get_active()));
        });
        group.add(quietSwitch);

        this.add(group);

        // --- Group 2: Add New Rule ---
        const addGroup = new Adw.PreferencesGroup({ title: 'Add Price Target Alert' });

        const symRow = new Adw.EntryRow({
            title: 'Symbol (e.g. AAPL, BTC-USD)'
        });
        addGroup.add(symRow);

        const condRow = new Adw.ComboRow({
            title: 'Trigger Condition',
            model: new Gtk.StringList({
                strings: ['Price Rises Above Target', 'Price Drops Below Target', 'Daily Surge (% Gain)', 'Daily Decline (% Drop)']
            })
        });
        addGroup.add(condRow);

        const valRow = new Adw.SpinRow({
            title: 'Threshold Value ($ or %)',
            digits: 2,
            adjustment: new Gtk.Adjustment({
                lower: 0.01,
                upper: 1000000,
                step_increment: 1,
                value: 100
            })
        });
        addGroup.add(valRow);

        const addBtnRow = new Adw.ActionRow({ title: '' });
        const addBtn = new Gtk.Button({
            label: '➕ Add Alert Rule',
            css_classes: ['suggested-action'],
            valign: Gtk.Align.CENTER
        });

        addBtn.connect('clicked', () => {
            const symbol = symRow.get_text().trim().toUpperCase();
            if (!symbol) return;

            const condIdx = condRow.get_selected();
            const condMap = ['ABOVE_PRICE', 'BELOW_PRICE', 'GAIN_PCT', 'LOSS_PCT'];
            const condition = condMap[condIdx];
            const threshold = valRow.get_value();

            const rule = new AlertRule({ symbol, condition, threshold });
            const currentRules = this._settingsHelper.getAlertRules();
            currentRules.push(rule);
            this._settingsHelper.saveAlertRules(currentRules);

            symRow.set_text('');
            this.refreshRulesList();
        });

        addBtnRow.add_suffix(addBtn);
        addGroup.add(addBtnRow);
        this.add(addGroup);

        // --- Group 3: Configured Rules List ---
        this._rulesGroup = new Adw.PreferencesGroup({ title: 'Active Alert Rules' });
        this.refreshRulesList();
        this.add(this._rulesGroup);
    }

    refreshRulesList() {
        for (const child of this._rulesGroup.get_children()) {
            this._rulesGroup.remove(child);
        }

        const rules = this._settingsHelper.getAlertRules();

        if (rules.length === 0) {
            const emptyRow = new Adw.ActionRow({
                title: 'No active alert rules configured',
                subtitle: 'Add a target price or percentage change rule above'
            });
            this._rulesGroup.add(emptyRow);
            return;
        }

        for (const rule of rules) {
            let desc = '';
            if (rule.condition === 'ABOVE_PRICE') desc = `Target: Price >= $${rule.threshold.toFixed(2)}`;
            else if (rule.condition === 'BELOW_PRICE') desc = `Target: Price <= $${rule.threshold.toFixed(2)}`;
            else if (rule.condition === 'GAIN_PCT') desc = `Target: Surge >= +${rule.threshold.toFixed(2)}%`;
            else if (rule.condition === 'LOSS_PCT') desc = `Target: Drop >= -${rule.threshold.toFixed(2)}%`;

            const row = new Adw.SwitchRow({
                title: `${rule.symbol}`,
                subtitle: desc,
                active: rule.enabled
            });

            row.connect('notify::active', () => {
                rule.enabled = row.get_active();
                const current = this._settingsHelper.getAlertRules();
                const target = current.find(r => r.id === rule.id);
                if (target) target.enabled = rule.enabled;
                this._settingsHelper.saveAlertRules(current);
            });

            const delBtn = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['destructive-action']
            });
            delBtn.connect('clicked', () => {
                const current = this._settingsHelper.getAlertRules();
                const updated = current.filter(r => r.id !== rule.id);
                this._settingsHelper.saveAlertRules(updated);
                this.refreshRulesList();
            });
            row.add_suffix(delBtn);

            this._rulesGroup.add(row);
        }
    }
});
