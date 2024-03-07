/**
 * Custom Hot Corners - Extended
 * OptionfFactory
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import * as Settings from '../common/settings.js';


export const ItemFactory = class ItemFactory {
    constructor(options) {
        this._options = options;
        this._settings = this._options._gsettings;
    }

    getRowWidget(text, caption, widget, variable, options = []) {
        let item = [];
        let label;
        if (widget) {
            label = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
            });
            const option = new Gtk.Label({
                halign: Gtk.Align.START,
            });
            option.set_text(text);
            label.append(option);

            if (caption) {
                const captionLabel = new Gtk.Label({
                    halign: Gtk.Align.START,
                    wrap: true,
                    /* width_chars: 80,*/
                    xalign: 0,
                });
                const context = captionLabel.get_style_context();
                context.add_class('dim-label');
                context.add_class('caption');
                captionLabel.set_text(caption);
                label.append(captionLabel);
            }
            label._title = text;
        } else {
            label = text;
        }
        item.push(label);
        item.push(widget);

        let key;

        if (variable && this._options.options[variable]) {
            const opt = this._options.options[variable];
            key = opt.key;
        }

        if (widget) {
            if (widget._is_switch)
                this._connectSwitch(widget, key, variable);
            else if (widget._is_spinbutton)
                this._connectSpinButton(widget, key, variable);
            else if (widget._is_combo_box)
                this._connectComboBox(widget, key, variable, options);
            else if (widget && (widget._is_color_btn || widget._is_color_box))
                this._connectColorButton(widget, key, variable);
        }

        return item;
    }

    _connectSwitch(widget, key) {
        this._settings.bind(key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    _connectSpinButton(widget, key) {
        this._settings.bind(key, widget.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
    }

    _connectComboBox(widget, key, variable, options) {
        let model = widget.get_model();
        widget._comboMap = {};
        for (const [label, value] of options) {
            let iter;
            model.set(iter = model.append(), [0, 1], [label, value]);
            if (value === this._options.get(variable))
                widget.set_active_iter(iter);

            widget._comboMap[value] = iter;
        }
        this._options.connect(`changed::${key}`, () => {
            widget.set_active_iter(widget._comboMap[this._options.get(variable, true)]);
        });
        widget.connect('changed', () => {
            const [success, iter] = widget.get_active_iter();

            if (!success)
                return;

            this._options.set(variable, model.get_value(iter, 1));
        });
    }

    _connectColorButton(widget, key, variable) {
        let colorBtn;
        if (widget._is_color_box)
            colorBtn = widget.colorBtn;
        else
            colorBtn = widget;

        const rgba = colorBtn.get_rgba();
        rgba.parse(this._options.get(variable));
        colorBtn.set_rgba(rgba);

        colorBtn.connect('color_set', () => {
            this._options.set(variable, `${colorBtn.get_rgba().to_string()}`);
        });

        this._settings.connect(`changed::${key}`, () => {
            const rgba = colorBtn.get_rgba();
            rgba.parse(this._options.get(variable));
            colorBtn.set_rgba(rgba);
        });
    }

    newSwitch() {
        let sw = new Gtk.Switch({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        sw._is_switch = true;
        return sw;
    }

    newSpinButton(adjustment) {
        let spinButton = new Gtk.SpinButton({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            vexpand: false,
            xalign: 0.5,
        });
        spinButton.set_adjustment(adjustment);
        spinButton._is_spinbutton = true;
        return spinButton;
    }

    newComboBox() {
        const model = new Gtk.ListStore();
        model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT]);
        const comboBox = new Gtk.ComboBox({
            model,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        const renderer = new Gtk.CellRendererText();
        comboBox.pack_start(renderer, true);
        comboBox.add_attribute(renderer, 'text', 0);
        comboBox._is_combo_box = true;
        return comboBox;
    }

    newEntry() {
        const entry = new Gtk.Entry({
            width_chars: 6,
            max_width_chars: 5,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            xalign: 0.5,
        });
        entry._is_entry = true;
        return entry;
    }

    newColorButton() {
        const colorBtn = new Gtk.ColorButton({
            hexpand: true,
            halign: Gtk.Align.END,
        });
        colorBtn.set_use_alpha(false);
        colorBtn._is_color_btn = true;

        return colorBtn;
    }

    newLabel(text = '') {
        const label = new Gtk.Label({
            label: text,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        label._activatable = false;
        return label;
    }

    newLinkButton(uri) {
        const linkBtn = new Gtk.LinkButton({
            label: '',
            uri,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        return linkBtn;
    }

    newOptionsResetButton() {
        const btn = new Gtk.Button({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });

        const context = btn.get_style_context();
        context.add_class('destructive-action');

        btn.icon_name = 'view-refresh-symbolic';

        btn.connect('clicked', () => {
            this._options.resetAll();
            Settings.resetAllCorners();
        });
        btn._activatable = false;
        return btn;
    }
};

export const OptionsPageAdw = GObject.registerClass(
class OptionsPageAdw extends Adw.PreferencesPage {
    _init(optionList, pageProperties = {}) {
        super._init(pageProperties);

        this._optionList = optionList;
        this.buildPage();
    }

    buildPage() {
        if (this._alreadyBuilt)
            return;
            // pageProperties.width_request = 840;
        let group;
        for (let item of this._optionList) {
            // label can be plain text for Section Title
            // or GtkBox for Option
            const option = item[0];
            const widget = item[1];
            if (!widget) {
                if (group)
                    this.add(group);

                group = new Adw.PreferencesGroup({
                    title: option,
                    hexpand: true,
                    // width_request: 700
                });
                continue;
            }

            const row = new Adw.ActionRow({
                title: option._title,
            });

            const grid = new Gtk.Grid({
                column_homogeneous: false,
                column_spacing: 20,
                margin_start: 8,
                margin_end: 8,
                margin_top: 8,
                margin_bottom: 8,
                hexpand: true,
            });
                /* for (let i of item) {
                    box.append(i);*/
            grid.attach(option, 0, 0, 1, 1);
            if (widget)
                grid.attach(widget, 1, 0, 1, 1);

            row.set_child(grid);
            if (widget._activatable === false)
                row.activatable = false;
            else
                row.activatable_widget = widget;

            group.add(row);
        }
        this.add(group);
        this._alreadyBuilt = true;
    }
});

