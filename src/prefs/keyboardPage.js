/**
 * Custom Hot Corners - Extended
 * KeayboardPage
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import * as TreeViewPage from './treeViewPage.js';
import * as Settings from '../common/settings.js';

import * as Utils from '../common/utils.js';

// gettext
let _;
let Me;

const _bold = Utils.bold;

export function init(extension) {
    _ = extension.gettext.bind(extension);
    Me = extension;
}

export function cleanGlobals() {
    _ = null;
    Me = null;
}

export const KeyboardPage = GObject.registerClass(
class KeyboardPage extends TreeViewPage.TreeViewPage {
    _init(mscOptions) {
        super._init();
        this._mscOptions = mscOptions;
        this._alreadyBuilt = false;

        this.buildPage();
    }

    buildPage() {
        if (this._alreadyBuilt)
            return false;

        this.buildWidgets();
        this._loadShortcuts();
        this._treeviewModelColumns = [GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_INT, GObject.TYPE_INT];
        this._mscOptions.connect('changed::keyboard-shortcuts', () => {
            if (!this._mscOptions.get('keyboardShortcuts', true).length) {
                // only reset page, skip writing to settings
                this._resetShortcuts(false);
            }
        });

        this._updateTitle();
        this.lbl.set_tooltip_text(`${_('Click on the Shortcut Key cell to set new shortcut.')}\n${
            _('Press Backspace key instead of the new shortcut to disable shortcut.')}\n${
            _('Warning: Some system shortcuts can NOT be overriden here.')}\n${
            _('Warning: Shortcuts already used in this extension will be ignored.')}`);
        this.resetButton.set_label(_('Disable all'));
        this.resetButton.set_tooltip_text(_('Remove all keyboard shortcuts'));
        this.resetButton.connect('clicked', () => {
            this._resetShortcuts();
        });
        this.showActiveBtn.connect('notify::active', () => {
            this.setNewTreeviewModel();
            this.treeView.expand_all();
            this.treeView.grab_focus();
        });

        this.setNewTreeviewModel();

        // Hotkey
        const actions     = new Gtk.TreeViewColumn({ title: _('Action'), expand: true });
        const nameRender  = new Gtk.CellRendererText();

        const accels      = new Gtk.TreeViewColumn({ title: _('Shortcut'), min_width: 150 });
        const accelRender = new Gtk.CellRendererAccel({
            editable: true,
            accel_mode: Gtk.CellRendererAccelMode.GTK,
        });

        actions.pack_start(nameRender, true);
        accels.pack_start(accelRender, true);

        actions.add_attribute(nameRender, 'text', 1);
        accels.add_attribute(accelRender, 'accel-mods', 2);
        accels.add_attribute(accelRender, 'accel-key', 3);

        /* actions.set_cell_data_func(nameRender, (column, cell, model, iter) => {
            if (!model.get_value(iter, 0)) {
                // not used
            }
        });*/

        accels.set_cell_data_func(accelRender, (column, cell, model, iter) => {
            // this function is for dynamic control of column cells properties
            // and is called whenever the content has to be redrawn,
            // which is even on mouse pointer hover over items
            if (!model.get_value(iter, 0))
                cell.set_visible(false);
                // [cell.accel_key, cell.accel_mods] = [45, 0];
            else
                cell.set_visible(true);
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
        const uniqueVal = (dict, value) => {
            let unique = true;
            Object.entries(dict).forEach(([/* key*/, val]) => {
                if (value === val)
                    unique = false;
            }
            );
            return unique;
        };

        accelRender.connect('accel-cleared', (rend, path/* , key, mods*/) => {
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

        if (this.show_all)
            this.show_all();

        this._alreadyBuilt = true;
        return true;
    }

    _updateTitle() {
        this.lbl.set_markup(`${_bold(_('Keyboard Shortcuts'))}    (${_('active')}: ${Object.keys(this.keybindings).length})`);
    }

    _loadShortcuts() {
        this.keybindings = {};
        const shortcuts = this._mscOptions.get('keyboardShortcuts');
        shortcuts.forEach(sc => {
            // action, accelerator pairs are separated by a space
            let [action, accelerator] = sc.split(' ');
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

    _resetShortcuts(writeSettings = true) {
        if (writeSettings)
            this._mscOptions.set('keyboardShortcuts', []);
        this._loadShortcuts();
        this.setNewTreeviewModel();
        this._updateTitle();
        this.treeView.grab_focus();
    }

    _populateTreeview() {
        let iter1, iter2;
        let submenuOnHold = null;
        const actionList = Settings.actionList;
        const excludedItems = Settings.excludedItems;
        for (let i = 0; i < actionList.length; i++) {
            const item = actionList[i];
            const itemMeaning = item[0];
            const action = item[1];
            const title = item[2];
            const shortcutAllowed = item[3];

            if (excludedItems.includes(action) || !shortcutAllowed)
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
                if (itemMeaning === 0)
                    this.model.set(iter1, [0, 1, 2, 3], [action, title, ...a]);
                else
                    this.model.set(iter1, [1], [title]);
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
