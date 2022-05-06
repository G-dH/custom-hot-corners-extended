/* Custom Hot Corners - Extended
 * Copyright 2021-2022 GdH <G-dH@github.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

const { Gtk, Gio, GObject } = imports.gi;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

const Config = imports.misc.config;
var shellVersion = parseFloat(Config.PACKAGE_VERSION);

// conversion of Gtk3 / Gtk4 widgets add methods
const append = shellVersion < 40 ? 'add' : 'append';
const set_child = shellVersion < 40 ? 'add' : 'set_child';

var mscOptions;

function getOptionList(mscOpt) {
    mscOptions = mscOpt;

    let optionsList = [];
        // options item format:
        // [text, caption, widget, settings-variable, options for combo]

        optionsList.push(
            _optionsItem(
                _('Global options'),
                null, null, null
            )
        );

        optionsList.push(
            _optionsItem(
                _('Watch hot corners for external overrides'),
                _('Update corners when something (usualy other extensions) change them'),
                _newGtkSwitch(), 'watchCorners'
            )
        );

        let actionDelayAdjustment = new Gtk.Adjustment({
            upper: 1000,
            step_increment: 10,
            page_increment: 10,
        });

        optionsList.push(
            _optionsItem(
                _('Minimum delay between actions (ms)'),
                _('Prevents accidental double-action. Ignored by volume control'),
                _newSpinButton(actionDelayAdjustment),
                'actionEventDelay'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Show ripple animations'),
                _('When you trigger an action, ripples are animated from the corresponding corner'),
                _newGtkSwitch(),
                'rippleAnimation'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Direct hot corner triggers require Shift'),
                _('All hot corner triggers that are directly accessible (without Ctrl) require the Shift key pressed to be activated. This option is primarily meant as a temporary solution accessible also as an action using a keyboard shortcut or mouse trigger to avoid accidental activation of hot corners in specific situations as playing full-screen games.'),
                _newGtkSwitch(), 'hotCornersRequireShift'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Use fallback hot corner triggers'),
                _("If pressure barriers don't work, this option allows trigger the hot corner action by hovering the corner"),
                _newGtkSwitch(),
                'barrierFallback'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Make active corners / edges visible'),
                _('Shows which corners are active and their size/expansion settings. Pressure barriers are green, clickable areas are orange'),
                _newGtkSwitch(),
                'cornersVisible'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Window switcher'),
                null,
                null
            )
        );

        optionsList.push(
            _optionsItem(
                _('Wraparound'),
                _('Whether the switcher should continue from the last window to the first and vice versa'),
                _newGtkSwitch(),
                'winSwitchWrap'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Stable sequence'),
                _("By default windows are sorted by the MRU (Most Recently Used) AltTab list, which is given by time stamps that are updated each time the window is activated by the user. The stable sequence is given by the unique ID that each window gets when it's created."),
                _newGtkSwitch(),
                'winStableSequence'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Skip minimized'),
                _('Exclude minimized windows from the switcher list'),
                _newGtkSwitch(),
                'winSkipMinimized'
            )
        );

        optionsList.push(
            _optionsItem(
                _('DND Window Thumbnails'),
                `${_('Window thumbnails are overlay clones of windows, can be draged by mouse anywhere on the screen')}\n${
                    _('Thumbnail control:')}\n    ${
                    _('Double click:    \t\tactivate source window')}\n    ${
                    _('Primary click:   \t\ttoggle scroll wheel function (resize / source)')}\n    ${
                    _('Secondary click: \t\tshow full size window preview')}\n    ${
                    _('Middle click:    \t\ttoggle icon view')}\n    ${
                    _('Scroll wheel:    \t\tresize or change source window')}\n    ${
                    _('Ctrl + Scroll wheel: \tchange source window or resize')}\n    ${
                    _('Shift + Scroll wheel: \tadjust opacity')}\n    `
                ,
                null
            )
        );

        let tmbScaleAdjustment = new Gtk.Adjustment({
            lower: 5,
            upper: 50,
            step_increment: 1,
            page_increment: 10,
        });

        optionsList.push(
            _optionsItem(
                _('Thumbnail height scale (%)'),
                _('Height of the thumbnail relative to screen height'),
                _newSpinButton(tmbScaleAdjustment),
                'winThumbnailScale'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Custom Colors for Effects'),
                null,
                null
            )
        );

        optionsList.push(
            _optionsItem(
                _('Tint Color'),
                _("Color for 'Custom Color Tint' action. Lighter color means weaker filter."),
                _newColorButton(),
                'customTintColor'
            )
        );

        return optionsList;
}

function _newScale(adjustment) {
    const scale = new Gtk.Scale({
        orientation: Gtk.Orientation.HORIZONTAL,
        draw_value:  true,
        has_origin:  false,
        value_pos:   Gtk.PositionType.LEFT,
        digits:      0,
        halign:      Gtk.Align.FILL,
        valign:      Gtk.Align.CENTER,
        hexpand:     true,
        vexpand:     false,
    });
    scale.set_adjustment(adjustment);
    scale._is_scale = true;
    return scale;
}

function _newGtkSwitch() {
    let sw = new Gtk.Switch({
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    sw._is_switch = true;
    return sw;
}

function _newSpinButton(adjustment) {
    let spinButton = new Gtk.SpinButton({
        halign: Gtk.Align.END,
        hexpand: true,
        xalign: 0.5,
    });
    spinButton.set_adjustment(adjustment);
    spinButton._is_spinbutton = true;
    return spinButton;
}

function _newComboBox() {
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

function _newColorButton() {
    const colorBtn = new Gtk.ColorButton({
        hexpand: true,
        halign: Gtk.Align.END,
    });
    colorBtn.set_use_alpha(false);
    colorBtn.is_color_btn = true;

    return colorBtn;
}

function _optionsItem(text, caption, widget, variable, options = []) {
    let item = [];
    let label;
    if (widget) {
        label = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            halign: Gtk.Align.START,
            visible: true,
        })

        const option = new Gtk.Label({
            halign: Gtk.Align.START,
        });
        option.set_markup(text);
        label[append](option);

        if (caption) {
            const captionLbl = new Gtk.Label({
                label: caption,
                halign: Gtk.Align.START,
                visible: true,
                wrap: true,
                xalign: 0
            })
            const context = captionLbl.get_style_context();
            context.add_class('dim-label');
            context.add_class('caption');

            label[append](captionLbl);
        }
        label._title = text;
    } else {
        label = text;
    }

    item.push(label);
    item.push(widget);

    if (widget && widget._is_switch) {
        mscOptions._gsettings.bind(mscOptions.options[variable].key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
    } else if (widget && (widget._is_spinbutton || widget._is_scale)) {
        mscOptions._gsettings.bind(mscOptions.options[variable].key, widget.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
    } else if (widget && widget._is_combo_box) {
        let model = widget.get_model();
        for (const [label, value] of options) {
            let iter;
            model.set(iter = model.append(), [0, 1], [label, value]);
            if (value === mscOptions.get(variable))
                widget.set_active_iter(iter);
        }
        widget.connect('changed', item => {
            const [success, iter] = widget.get_active_iter();
            if (!success)
                return;

            mscOptions.set(variable, model.get_value(iter, 1));
        });
    } else if (widget && (widget.is_color_btn || widget.is_color_box)) {
        let colorBtn;
        if (widget.is_color_box) {
            colorBtn = widget.colorBtn;
        } else {
            colorBtn = widget;
        }
        const rgba = colorBtn.get_rgba();
        rgba.parse(mscOptions.get(variable));
        colorBtn.set_rgba(rgba);

        colorBtn.connect('color_set', () => {
            mscOptions.set(variable, `${colorBtn.get_rgba().to_string()}`);
        });

        mscOptions._gsettings.connect(`changed::${mscOptions.options[variable].key}`,() => {
            const rgba = colorBtn.get_rgba();
            rgba.parse(mscOptions.get(variable));
            colorBtn.set_rgba(rgba);
        });
    }

    return item;
}