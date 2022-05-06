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

let Adw = null;
try { Adw = imports.gi.Adw; } catch (e) {}

const Settings       = Me.imports.src.common.settings;
const _actionList    = Settings.actionList;

// gettext
const _  = Settings._;
const shellVersion = Settings.shellVersion;

const _excludedItems = Settings.excludedItems;

const Utils          = Me.imports.src.common.utils;
// conversion of Gtk3 / Gtk4 widgets add methods
const append = Utils.append;
const set_child = Utils.set_child;

const _bold = Utils.bold;

const TRANSITION_DURATION = Settings.TRANSITION_DURATION;

var CustomMenusPage = GObject.registerClass(
class CustomMenusPage extends Gtk.Box {
    _init(mscOptions, widgetProperties ={
        orientation: Gtk.Orientation.VERTICAL,
        visible: true
    }) {
        super._init(widgetProperties);
        this._mscOptions = mscOptions;
        this._menusCount = 4;
        this._alreadyBuilt = false;
    }

    buildPage() {
        if (this._alreadyBuilt)
            return;

        const margin =16;
        const context = this.get_style_context();
        context.add_class('background');
        const switcher = new Gtk.StackSwitcher({
            hexpand: true,
            halign: Gtk.Align.CENTER,
            margin_top: Adw ? 0 : margin,
            margin_bottom: Adw ? margin : 0
        });
        const stack = new Gtk.Stack({
            hexpand: true,
        });

        stack.connect('notify::visible-child', () => {
            stack.get_visible_child().buildPage();
        });

        stack.set_transition_duration(TRANSITION_DURATION);
        stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT);
        switcher.set_stack(stack);

        for (let i = 1; i <= this._menusCount; i++) {
            let menu = new CustomMenuPage(i, this._mscOptions);
            const title = `${_('Menu ')}${i}`;
            const name = `menu-${i}`;
            stack.add_titled(menu, name, title);
            menu.hexpand = true;
        }

        this[append](switcher);
        this[append](stack);
        this.show_all && this.show_all();
        this._alreadyBuilt = true;
    }
});

const CustomMenuPage = GObject.registerClass(
class CustomMenuPage extends TreeViewPage {
    _init(menuIndex, mscOptions) {
        super._init();
        this._mscOptions = mscOptions;
        this._alreadyBuilt = false;
        this._menuIndex = menuIndex;
        this._treeviewModelColumns = [GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_INT, GObject.TYPE_INT];
    }

    buildPage() {
        if (this._alreadyBuilt)
            return;
        this.buildWidgets();
        //this.treeView.set_reorderable(true);
        this.menuItems = this._mscOptions.get(`customMenu${this._menuIndex}`);

        this._updateTitle();
        this.lbl.set_tooltip_text(`${_('Check items you want to have in the Custom Menu action.')}\n${_('You can decide whether the action menu items will be in its section submenu or in the root of the menu by checking/unchecking the section item')}`);
        this.resetButton.set_label(_('Deselect all'));
        this.resetButton.set_tooltip_text(_('Remove all items from this menu'));
        this.resetButton.connect('clicked', () => {
            this.menuItems = [];
            this._mscOptions.set(`customMenu${this._menuIndex}`, this.menuItems);
            this._setNewTreeviewModel(this._treeviewModelColumns);
            this._updateTitle();
            this.treeView.grab_focus();
        });
        this.showActiveBtn.connect('notify::active', () => {
            this._setNewTreeviewModel(this._treeviewModelColumns);
            this.treeView.expand_all();
            this.treeView.grab_focus();
        });
        this._setNewTreeviewModel(this._treeviewModelColumns);

        // Menu items
        const actions     = new Gtk.TreeViewColumn({title: _('Menu Item'), expand: true});
        const nameRender  = new Gtk.CellRendererText();

        const toggles      = new Gtk.TreeViewColumn({title: _('Add to Menu')});
        const toggleRender = new Gtk.CellRendererToggle({
            activatable: true,
            active: false,
        });

        actions.pack_start(nameRender, true);
        toggles.pack_start(toggleRender, true);

        actions.add_attribute(nameRender, 'text', 1);
        toggles.add_attribute(toggleRender, 'active', 2);

        /*actions.set_cell_data_func(nameRender, (column, cell, model, iter) => {
            if (model.get_value(iter, 0).includes('submenu')) {
                // not used
            }
        });*/

        /*toggles.set_cell_data_func(toggleRender, (column, cell, model, iter) => {
            if (model.get_value(iter, 0).includes('submenu')) {
                cell.set_visible(false);
            } else {
                cell.set_visible(true);
            }
        });*/

        toggleRender.connect('toggled', (rend, path) => {
            // the path is string, not Gtk.TreePath
            const [succ, iter] = this.model.get_iter_from_string(path);
            this.model.set_value(iter, 2, !this.model.get_value(iter, 2));
            let item  = this.model.get_value(iter, 0);
            let value = this.model.get_value(iter, 2);
            let index = this.menuItems.indexOf(item);
            if (index > -1) {
                if (!value)
                    this.menuItems.splice(index, 1);
            } else if (value) {
                this.menuItems.push(item);
            }
            this._mscOptions.set(`customMenu${this._menuIndex}`, this.menuItems);
            this._updateTitle();
            // clicking toggle button also activates row which expand/colapse submenu row
            // following sort of fixes it for collapsed row but not for expanded
            /*if (item.includes('submenu')) {
                const pth = this.model.get_path(iter);
                if (this.treeView.row_expanded(pth)) {
                    this.treeView.collapse_row(pth);
                } else {
                    this.treeView.expand_row(pth, true);
                }
            }*/
            return false;
        });

        this.treeView.append_column(actions);
        this.treeView.append_column(toggles);

        this.show_all && this.show_all();

        this._alreadyBuilt = true;
        return true;
    }

    _updateTitle() {
        this.lbl.set_markup(_bold(_('Select items for Custom Menu')) + _bold(` ${this._menuIndex}`) + `     ( ${this.menuItems.length} ${_('items')} )`);
    }

    _populateTreeview() {
        let iter, iter1, iter2;
        let submenuOnHold = null;
        for (let i = 0; i < _actionList.length; i++) {
            const item = _actionList[i];
            const itemType = item[0];
            const action = item[1];
            const title = item[2];

            if (_excludedItems.includes(action) || action === 'disabled' || action === 'move-to-workspace' || action === 'run-command')
                continue;

            // show selected actions only
            if (this.showActiveBtn.active && !this.menuItems.includes(action) && (itemType !== null))
                continue;

            if (itemType === null) {
                submenuOnHold = item;
                continue;
            }

            if (!itemType) {
                iter1 = this.model.append(null);
                if (itemType === 0)
                    this.model.set(iter1, [0, 1], [action, title]);

                else
                    this.model.set(iter1, [0, 1], [action, title]);

                iter = iter1;
            } else {
                if (submenuOnHold) {
                    iter1 = this.model.append(null);
                    this.model.set(iter1, [0, 1], [submenuOnHold[1], submenuOnHold[2]]);
                    this.model.set_value(iter1, 2, this.menuItems.includes(submenuOnHold[1]));
                    submenuOnHold = null;
                }
                iter2  = this.model.append(iter1);
                this.model.set(iter2, [0, 1], [action, title]);
                iter = iter2;
            }
            this.model.set_value(iter, 2, this.menuItems.includes(action));
        }
    }
});