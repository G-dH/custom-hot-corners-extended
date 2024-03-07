/**
 * Custom Hot Corners - Extended
 * CustomMenusPage
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Adw from 'gi://Adw';

import * as TreeViewPage from './treeViewPage.js';

import * as Settings from '../common/settings.js';
import * as Utils from '../common/utils.js';

// gettext
let _;

const _bold = Utils.bold;

const TRANSITION_TIME = Settings.TRANSITION_TIME;

export function init(extension) {
    _ = extension.gettext.bind(extension);
}

export function cleanGlobals() {
    _ = null;
}

export const CustomMenusPage = GObject.registerClass(
class CustomMenusPage extends Gtk.Box {
    _init(mscOptions) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            visible: true,
        });
        this._mscOptions = mscOptions;
        this._menusCount = 4;
        this._alreadyBuilt = false;

        this.buildPage();
    }

    buildPage() {
        if (this._alreadyBuilt)
            return;

        const margin = 16;
        const context = this.get_style_context();
        context.add_class('background');
        const switcher = new Gtk.StackSwitcher({
            hexpand: true,
            halign: Gtk.Align.CENTER,
            margin_top: Adw ? 0 : margin,
            margin_bottom: Adw ? margin : 0,
        });
        const stack = new Gtk.Stack({
            hexpand: true,
        });

        stack.connect('notify::visible-child', () => {
            stack.get_visible_child().buildPage();
        });

        stack.set_transition_duration(TRANSITION_TIME);
        stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT);
        switcher.set_stack(stack);

        for (let i = 1; i <= this._menusCount; i++) {
            let menu = new CustomMenuPage(i, this._mscOptions);
            const title = `${_('Menu ')}${i}`;
            const name = `menu-${i}`;
            stack.add_titled(menu, name, title);
            menu.hexpand = true;
        }

        this.append(switcher);
        this.append(stack);
        if (this.show_all)
            this.show_all();
        this._alreadyBuilt = true;
    }
});

const CustomMenuPage = GObject.registerClass(
class CustomMenuPage extends TreeViewPage.TreeViewPage {
    _init(menuIndex, mscOptions) {
        super._init();
        this._mscOptions = mscOptions;
        this._alreadyBuilt = false;
        this._menuIndex = menuIndex;

        this._treeviewModelColumns = [GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_INT, GObject.TYPE_INT];
        this.buildPage();
    }

    buildPage() {
        if (this._alreadyBuilt)
            return;

        this.buildWidgets();
        // this.treeView.set_reorderable(true);
        const mscVar = `customMenu${this._menuIndex}`;
        this.menuItems = this._mscOptions.get(mscVar);
        this._mscOptions.connect(`changed::custom-menu-${this._menuIndex}`, () => {
            if (!this._mscOptions.get(mscVar, true).length) {
                // only reset page, skip writing to settings
                this._resetMenu(false, mscVar);
            }
        });

        this._updateTitle();
        this.lbl.set_tooltip_text(`${_('Check items you want to have in the Custom Menu action.')}\n${_('You can decide whether the action menu items will be in its section submenu or in the root of the menu by checking/unchecking the section item')}`);
        this.resetButton.set_label(_('Deselect all'));
        this.resetButton.set_tooltip_text(_('Remove all items from this menu'));
        this.resetButton.connect('clicked', () => {
            this._resetMenu(true, mscVar);
        });
        this.showActiveBtn.connect('notify::active', () => {
            this.setNewTreeviewModel();
            this.treeView.expand_all();
            this.treeView.grab_focus();
        });
        this.setNewTreeviewModel();

        // Menu items
        const actions     = new Gtk.TreeViewColumn({ title: _('Menu Item'), expand: true });
        const nameRender  = new Gtk.CellRendererText();

        const toggles      = new Gtk.TreeViewColumn({ title: _('Add to Menu') });
        const toggleRender = new Gtk.CellRendererToggle({
            activatable: true,
            active: false,
        });

        actions.pack_start(nameRender, true);
        toggles.pack_start(toggleRender, true);

        actions.add_attribute(nameRender, 'text', 1);
        toggles.add_attribute(toggleRender, 'active', 2);

        /* actions.set_cell_data_func(nameRender, (column, cell, model, iter) => {
            if (model.get_value(iter, 0).includes('submenu')) {
                // not used
            }
        });*/

        /* toggles.set_cell_data_func(toggleRender, (column, cell, model, iter) => {
            if (model.get_value(iter, 0).includes('submenu')) {
                cell.set_visible(false);
            } else {
                cell.set_visible(true);
            }
        });*/

        toggleRender.connect('toggled', (rend, path) => {
            // the path is string, not Gtk.TreePath
            const [/* succ*/, iter] = this.model.get_iter_from_string(path);
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
            this._mscOptions.set(mscVar, this.menuItems);
            this._updateTitle();
            // clicking toggle button also activates row which expand/colapse submenu row
            // following sort of fixes it for collapsed row but not for expanded
            /* if (item.includes('submenu')) {
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

        if (this.show_all)
            this.show_all();

        this._alreadyBuilt = true;
    }

    _updateTitle() {
        this.lbl.set_markup(`${_bold(_('Select items for Custom Menu')) + _bold(` ${this._menuIndex}`)}     ( ${this.menuItems.length} ${_('items')} )`);
    }

    _resetMenu(writeSettings = true, mscVar) {
        this.menuItems = [];
        if (writeSettings)
            this._mscOptions.set(mscVar, this.menuItems);
        this.setNewTreeviewModel();
        this._updateTitle();
        this.treeView.grab_focus();
    }

    _populateTreeview() {
        let iter, iter1, iter2;
        let submenuOnHold = null;
        const actionList = Settings.actionList;
        const excludedItems = Settings.excludedItems;
        for (let i = 0; i < actionList.length; i++) {
            const item = actionList[i];
            const itemType = item[0];
            const action = item[1];
            const title = item[2];

            if (excludedItems.includes(action) || action === 'disabled' || action === 'move-to-workspace' || action === 'run-command')
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
