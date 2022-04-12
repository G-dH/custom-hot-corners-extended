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

const Config = imports.misc.config;
var shellVersion = parseFloat(Config.PACKAGE_VERSION);

const OptionList = Me.imports.src.prefs.optionList;

// conversion of Gtk3 / Gtk4 widgets add methods
const append = shellVersion < 40 ? 'add' : 'append';
const set_child = shellVersion < 40 ? 'add' : 'set_child';

var OptionsPage;

let Adw = null;
try { Adw = imports.gi.Adw; } catch (e) {}

const OptionsPageLegacy = GObject.registerClass(
class OptionsPageLegacy extends Gtk.ScrolledWindow {
    _init(mscOptions, widgetProperties = {
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    }) {
        super._init(widgetProperties);
        this._optionList = OptionList.getOptionList(mscOptions);

        this._alreadyBuilt = false;
    }

    buildPage() {
        if (this._alreadyBuilt)
            return false;
        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5,
            homogeneous: false,
            margin_start: 16,
            margin_end: 16,
            margin_top: 16,
            margin_bottom: 16
        });

        const context = this.get_style_context();
        context.add_class('background');

        let optionsList = this._optionList;

        let frame;
        let frameBox;
        for (let item of optionsList) {
            const option = item[0];
            const widget = item[1];
            if (!widget) {
                let lbl = new Gtk.Label({
                    label: option, // option is a plain text if item is section title
                    xalign: 0,
                    margin_top: 4,
                    margin_bottom: 2
                });
                const context = lbl.get_style_context();
                context.add_class('heading');

                mainBox[append](lbl);

                frame = new Gtk.Frame({
                    margin_bottom: 10,
                });
                frameBox = new Gtk.ListBox({
                    selection_mode: null,
                });
                mainBox[append](frame);
                frame[set_child](frameBox);
                continue;
            }
            let box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                margin_start: 4,
                margin_end: 4,
                margin_top: 4,
                margin_bottom: 4,
                hexpand: true,
                spacing: 20,
            });

            box[append](option);
            if (widget)
                box[append](widget);

            frameBox[append](box);
        }
        this[set_child](mainBox);
        this.show_all && this.show_all();
        this._alreadyBuilt = true;
    }
});

if (Adw) {
    OptionsPage = Me.imports.src.prefs.optionsPageAdw.OptionsPageAdw;
} else {
    OptionsPage = OptionsPageLegacy;
}