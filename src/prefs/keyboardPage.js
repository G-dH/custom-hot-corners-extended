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

const { Gtk, GObject } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const TreeViewPage   = Me.imports.src.prefs.treeViewPage.TreeViewPage;

const Settings       = Me.imports.src.common.settings;
const _actionList    = Settings.actionList;
const _excludedItems = Settings.excludedItems;

// gettext
const _  = Settings._;
const shellVersion = Settings.shellVersion;

const Utils          = Me.imports.src.common.utils;
// conversion of Gtk3 / Gtk4 widgets add methods
const append = Utils.append;
const set_child = Utils.set_child;

const _bold = Utils.bold;

var KeyboardPage = GObject.registerClass(
class KeyboardPage extends TreeViewPage {
    _init(mscOptions) {
        super._init();
        this._mscOptions = mscOptions;
        this._alreadyBuilt = false;
    }

    buildPage() {
        if (this._alreadyBuilt)
            return false;

        this.buildWidgets();
        this._loadShortcuts();
        this._treeviewModelColumns = [GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_INT, GObject.TYPE_INT];

        this._updateTitle();
        this.lbl.set_tooltip_text(`${_('Click on the Shortcut Key cell to set new shortcut.')}\n${
            _('Press Backspace key instead of the new shortcut to disable shortcut.')}\n${
            _('Warning: Some system shortcuts can NOT be overriden here.')}\n${
            _('Warning: Shortcuts already used in this extension will be ignored.')}`);
        this.resetButton.set_label(_('Disable all'));
        this.resetButton.set_tooltip_text(_('Remove all keyboard shortcuts'));
        this.resetButton.connect('clicked', () => {
            mscOptions.set('keyboardShortcuts', []);
            this._loadShortcuts();
            this._setNewTreeviewModel(this._treeviewModelColumns);
            this._updateTitle();
            this.treeView.grab_focus();
        });
        this.showActiveBtn.connect('notify::active', () => {
            this._setNewTreeviewModel(this._treeviewModelColumns);
            this.treeView.expand_all();
            this.treeView.grab_focus();
        })

        this._setNewTreeviewModel(this._treeviewModelColumns);

        // Hotkey
        const actions     = new Gtk.TreeViewColumn({title: _('Action'), expand: true});
        const nameRender  = new Gtk.CellRendererText();

        const accels      = new Gtk.TreeViewColumn({title: _('Shortcut'), min_width: 150});
        const accelRender = new Gtk.CellRendererAccel({
            editable: true,
            accel_mode: Gtk.CellRendererAccelMode.GTK,
        });

        actions.pack_start(nameRender, true);
        accels.pack_start(accelRender, true);

        actions.add_attribute(nameRender, 'text', 1);
        accels.add_attribute(accelRender, 'accel-mods', 2);
        accels.add_attribute(accelRender, 'accel-key', 3);

        /*actions.set_cell_data_func(nameRender, (column, cell, model, iter) => {
            if (!model.get_value(iter, 0)) {
                // not used
            }
        });*/

        accels.set_cell_data_func(accelRender, (column, cell, model, iter) => {
            // this function is for dynamic control of column cells properties
            // and is called whenever the content has to be redrawn,
            // which is even on mouse pointer hover over items
            if (!model.get_value(iter, 0)) {
                cell.set_visible(false);
                //[cell.accel_key, cell.accel_mods] = [45, 0];
            } else {
                cell.set_visible(true);
            }
        });

        accelRender.connect('accel-edited', (rend, path, key, mods) => {
            // Don't allow single key accels
            if (!mods)
                return;
            const value = Gtk.accelerator_name(key, mods);
            const [succ, iter] = this.model.get_iter_from_string(path);
            if (!succ)
                throw new Error('Error updating keybinding');

            const name = this.model.get_value(iter, 0);
            // exclude group items and avoid duplicate accels
            // accels for group items now cannot be set, it was fixed
            if (name && !(value in this.keybindings) && uniqueVal(this.keybindings, value)) {
                this.model.set(iter, [2, 3], [mods, key]);
                this.keybindings[name] = value;
                this._saveShortcuts(this.keybindings);
            } else {
                log(`${Me.metadata.name} This keyboard shortcut is invalid or already in use!`);
            }
            this._updateTitle();
        });
        const uniqueVal = function (dict, value) {
            let unique = true;
            Object.entries(dict).forEach(([key, val]) => {
                if (value === val)
                    unique = false;
            }
            );
            return unique;
        };

        accelRender.connect('accel-cleared', (rend, path, key, mods) => {
            const [succ, iter] = this.model.get_iter_from_string(path);
            if (!succ)
                throw new Error('Error clearing keybinding');

            this.model.set(iter, [2, 3], [0, 0]);
            const name = this.model.get_value(iter, 0);

            if (name in this.keybindings) {
                delete this.keybindings[name];
                this._saveShortcuts(this.keybindings);
            }
            this._updateTitle();
        });

        this.treeView.append_column(actions);
        this.treeView.append_column(accels);

        this.show_all && this.show_all();

        this._alreadyBuilt = true;
        return true;
    }

    _updateTitle() {
        this.lbl.set_markup(_bold(_('Keyboard Shortcuts')) + `    (active: ${Object.keys(this.keybindings).length})`);
    }

    _loadShortcuts() {
        this.keybindings = {};
        const shortcuts = this._mscOptions.get('keyboardShortcuts');
        shortcuts.forEach(sc => {
            // split by non ascii character (causes automake gettext error) which was used before, or space which is used now
            let [action, accelerator] = sc.split(/[^\x00-\x7F]| /);
            this.keybindings[action] = accelerator;
        });
    }

    _saveShortcuts(keybindings) {
        const list = [];
        Object.keys(keybindings).forEach(s => {
            list.push(`${s} ${keybindings[s]}`);
        });
        this._mscOptions.set('keyboardShortcuts', list);
    }

    _populateTreeview() {
        let iter1, iter2;
        let submenuOnHold = null;
        for (let i = 0; i < _actionList.length; i++) {
            const item = _actionList[i];
            const itemMeaning = item[0];
            const action = item[1];
            const title = item[2];
            const shortcutAllowed = item[3];

            if (_excludedItems.includes(action) || !shortcutAllowed)
                continue;
            if (this.showActiveBtn.active && !(action in this.keybindings) && itemMeaning !== null)
                continue;
            if (itemMeaning === null) {
                submenuOnHold = item;
                continue;
            }

            let a = [0, 0];
            if (action && (action in this.keybindings && this.keybindings[action])) {
                let binding = this.keybindings[action];
                let ap = Gtk.accelerator_parse(binding);
                // Gtk4 accelerator_parse returns 3 values - the first one is bool ok/failed
                if (ap.length === 3)
                    ap.splice(0, 1);
                if (ap[0] && ap[1])
                    a = [ap[1], ap[0]];
                else
                    log(`[${Me.metadata.name}] Error: Gtk keybind conversion failed`);
            }
            if (!itemMeaning) {
                iter1  = this.model.append(null);
                if (itemMeaning === 0) {
                    this.model.set(iter1, [0, 1, 2, 3], [action, title, ...a]);
                } else {
                    this.model.set(iter1, [1], [title]);
                }
            } else {
                if (submenuOnHold) {
                    iter1 = this.model.append(null);
                    this.model.set(iter1, [1], [submenuOnHold[2]]);
                    submenuOnHold = null;
                }
                iter2  = this.model.append(iter1);
                this.model.set(iter2, [0, 1, 2, 3], [action, title, ...a]);
            }
        }
    }
});