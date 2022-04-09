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

const { Gtk, Gio, GObject, Adw } = imports.gi;

const Me = imports.misc.extensionUtils.getCurrentExtension();

const OptionList = Me.imports.src.prefs.optionList;

var OptionsPageAdw = GObject.registerClass(
    class OptionsPageAdw extends Adw.PreferencesPage {
        _init(mscOptions, pageProperties = {}) {
            super._init(pageProperties);
    
            this._optionList = OptionList.getOptionList(mscOptions);
            this.buildPage();
        }
    
        buildPage() {
            let group;
            for (let item of this._optionList) {
                // label can be plain text for Section Title
                // or GtkBox for Option
                const option = item[0];
                const widget = item[1];
                if (!widget) {
                    if (group) {
                        this.add(group);
                    }
                    group = new Adw.PreferencesGroup({
                        title: option,
                        hexpand: true,
                        //width_request: 700
                    });
                    continue;
                }
        
                const row = new Adw.PreferencesRow({
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
                })
        
                grid.attach(option, 0, 0, 1, 1);
                if (widget) {
                    grid.attach(widget, 1, 0, 1, 1);
                }
                row.set_child(grid);
                group.add(row);
            }
            this.add(group);
        }
    });
