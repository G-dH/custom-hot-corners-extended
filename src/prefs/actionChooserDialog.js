/**
 * Custom Hot Corners - Extended
 * ActionChooserDialog
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import * as Settings from '../common/settings.js';
import * as Utils from '../common/utils.js';

let _;

export function init(extension) {
    _ = extension.gettext.bind(extension);
}

export function cleanGlobals() {
    _ = null;
}

export const ActionChooserDialog = GObject.registerClass(
class ActionChooserDialog extends Gtk.Box {
    _init(button, corner, trigger, iconName, transitionWidget) {
        // this._transWidget = transitionWidget;
        const margin = 16;
        super._init({
            margin_top: margin,
            margin_bottom: margin,
            margin_start: margin,
            margin_end: margin,
        });

        // this._button = button;
        this._corner = corner;
        this._trigger = trigger;
        this._iconName = iconName;
        this._currentAction = this._corner.get('action', trigger);

        this._iconPath = Utils.getIconPath();

        this.dialog = new Gtk.Dialog({
            title: _('Choose Action'),
            transient_for: transitionWidget.get_root
                ? transitionWidget.get_root()
                : transitionWidget.get_toplevel(),
            use_header_bar: true,
            modal: true,
            height_request: 600,
        });

        const trgIcon = new Gtk.Image({
            // icon_name: this._iconName,
            pixel_size: 32, // pixel_size has no effect in Gtk3, the size is the same as declared in svg image when loaded from file
            visible: true,
        });

        trgIcon.set_from_resource(`${this._iconPath}/${this._iconName}`);
        trgIcon.icon_size = Gtk.IconSize.BUTTON;

        const box = new Gtk.Box({
            margin_start: 10,
            spacing: 4,
            visible: true,
        });
        if (trigger === 6) { // 6 === CTRL_PRESSURE
            box.append(new Gtk.Label({
                label: 'Ctrl +',
                visible: true,
            }));
        }
        box.append(trgIcon);

        const headerbar = this.dialog.get_titlebar();
        headerbar.pack_start(box);

        this.dialog.get_content_area().append(this);

        this.buildPage();

        this.dialog.connect('destroy', () => {
        });
    }

    buildPage() {
        this.buildWidgets();
        this.resetButton.set_label(_('Cancel'));
        this.resetButton.connect('clicked', () => {
            this.dialog.destroy();
        });

        // Actions
        const actions = new Gtk.TreeViewColumn({
            title: _('Action'),
            expand: true,
        });
        const nameRender = new Gtk.CellRendererText();

        actions.pack_start(nameRender, true);
        actions.add_attribute(nameRender, 'text', 1);

        this.treeView.connect('row-activated', (treeView, path/* , column*/) => {
            const [succ, iter] = this.model.get_iter(path);
            if (!succ)
                return false;
            const action  = this.model.get_value(iter, 0);
            // const title = this.model.get_value(iter, 1);
            if (action) {
                this._corner.set('action', action, this._trigger);
                this.dialog.destroy();
                return true;
            }
            return false;
        });

        this.treeView.append_column(actions);

        if (this.show_all)
            this.show_all();

        this._alreadyBuilt = true;
        return true;
    }

    buildWidgets() {
        if (this._alreadyBuilt)
            return;

        const margin = 0;
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5,
            homogeneous: false,
            margin_start: margin,
            margin_end: margin,
            margin_top: margin,
            margin_bottom: margin,
        });
        const scrolledWindow = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        });

        const frame = new Gtk.Frame();
        this.treeView = new Gtk.TreeView({
            enable_search: true,
            search_column: 1,
            hover_selection: true,
            // hover_expand: true,
            hexpand: true,
            vexpand: true,
        });

        this.treeView.set_search_equal_func(this._searchEqualFunc.bind(this));
        this.treeView.activate_on_single_click = true;
        this.treeView.connect('row-activated', (treeView, path/* , column*/) => {
            if (treeView.row_expanded(path))
                treeView.collapse_row(path);
            else
                treeView.expand_row(path, false);
        });

        this.model = new Gtk.TreeStore();
        this.model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);
        this.treeView.model = this.model;

        this._populateTreeview();

        if (this._currentPath) {
            this.treeView.expand_row(this._currentPath[0], true); // path, expand recursive
            this.treeView.scroll_to_cell(this._currentPath[1], null, true, 0.25, 0); // path, column, align?, align row, align column
            this.treeView.set_cursor(this._currentPath[1], null, false); // path, column, start edit
        }

        const btnBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            hexpand: true,
            homogeneous: true,
            spacing: 4,
        });
        const expandButton = new Gtk.Button({
            label: _('Expand all'),
        });
        expandButton.connect('clicked', () => {
            this.treeView.expand_all();
            this.treeView.grab_focus();
        });

        const collapseButton = new Gtk.Button({
            label: _('Collapse all'),
        });
        collapseButton.connect('clicked', () => {
            this.treeView.collapse_all();
            this.treeView.grab_focus();
        });

        this.resetButton = new Gtk.Button();

        btnBox.append(expandButton);
        btnBox.append(collapseButton);
        btnBox.append(this.resetButton);

        scrolledWindow.set_child(this.treeView);
        frame.set_child(scrolledWindow);

        box.append(frame);
        box.append(btnBox);
        this.append(box);
    }

    _populateTreeview() {
        let iter1, iter2;
        let submenuOnHold = null;
        const actionList = Settings.actionList;
        const excludedItems = Settings.excludedItems;
        for (let i = 0; i < actionList.length; i++) {
            const item = actionList[i];
            const itemType = item[0];
            const action = item[1];
            const title = action === 'disabled' ? 'Disable' : item[2];

            if (excludedItems.includes(action))
                continue;

            if (itemType === null) {
                submenuOnHold = item;
                continue;
            }

            if (!itemType) {
                iter1 = this.model.append(null);
                if (itemType === 0) {
                    // root action item
                    this.model.set(iter1, [0, 1], [action, title]);
                }

                // iter = iter1;
            } else {
                if (submenuOnHold) {
                    iter1 = this.model.append(null);
                    this.model.set(iter1, [0, 1], ['', submenuOnHold[2]]);
                    submenuOnHold = null;
                }
                iter2  = this.model.append(iter1);
                this.model.set(iter2, [0, 1], [action, title]);
                // iter = iter2;
                if (action === this._currentAction)
                    this._currentPath = [this.model.get_path(iter1), this.model.get_path(iter2)];
            }
        }
    }

    // treeview search function
    _searchEqualFunc(model, column, key, iter) {
        this.treeView.expand_all();
        const title = model.get_value(iter, 1).toLowerCase();
        key = key.toLowerCase();
        if (title.includes(key))
            return false;
        return true;
    }
});
