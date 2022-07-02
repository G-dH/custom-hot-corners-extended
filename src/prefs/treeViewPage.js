/**
 * Custom Hot Corners - Extended
 * TreeViewPage
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2022
 * @license    GPL-3.0
 */

'use strict';

const { Gtk, GObject } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();

const Settings       = Me.imports.src.common.settings;
const _actionList    = Settings.actionList;

// gettext
const _  = Settings._;
const shellVersion = Settings.shellVersion;

const Utils          = Me.imports.src.common.utils;
// conversion of Gtk3 / Gtk4 widgets add methods
const append = Utils.append;
const set_child = Utils.set_child;

let Adw = null;
try { Adw = imports.gi.Adw; } catch (e) {}

var TreeViewPage = GObject.registerClass(
class TreeviewPage extends Gtk.Box {
    _init(widgetProperties = {
        margin_start: 16,
        margin_end: 16,
        margin_top: Adw ? 0 : 16,
        margin_bottom: 16
    }) {
        super._init(widgetProperties);

        const context = this.get_style_context();
        context.add_class('background');

        this.label = null;
        this.treeView = null;
        this.resetButton = null;
    }

    buildWidgets() {
        if (this._alreadyBuilt)
            return;

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5,
            homogeneous: false,
        });
        const scrolledWindow = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        });
        this.lbl = new Gtk.Label({
            xalign: 0,
            use_markup: true,
        });

        const frame = new Gtk.Frame();
        this.treeView = new Gtk.TreeView({
            enable_search: true,
            search_column: 1,
            hover_selection: true,
            //activate_on_single_click: true,
            //hover_expand: true,
            hexpand: true,
            vexpand: true
        });

        this.treeView.set_search_equal_func(this._searchEqualFunc.bind(this));
        this.treeView.connect('row-activated', (treeView,path,column) => {
            if (treeView.row_expanded(path)) {
                treeView.collapse_row(path);
            } else {
                treeView.expand_row(path, false);
            }
        });

        const btnBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            hexpand: true,
            homogeneous: true,
            spacing: 4
        });

        const expandButton = new Gtk.Button({
            label: _('Expand all')
        });

        expandButton.connect('clicked', () => {
            this.treeView.expand_all();
            this.treeView.grab_focus();
        });

        const collapseButton = new Gtk.Button({
            label: _('Collapse all')
        });
        collapseButton.connect('clicked', () => {
            this.treeView.collapse_all();
            this.treeView.grab_focus();
        });

        this.resetButton = new Gtk.Button();
        this.showActiveBtn = new Gtk.ToggleButton({
            label: _('Show active items only')
        });

        btnBox[append](expandButton);
        btnBox[append](collapseButton);
        btnBox[append](this.resetButton);

        scrolledWindow[set_child](this.treeView);
        frame[set_child](scrolledWindow);

        box[append](this.lbl);
        box[append](frame);
        box[append](this.showActiveBtn);
        box[append](btnBox);
        this[append](box);
    }

    _setNewTreeviewModel(columns) {
        if (this.model) {
            this.model = null;
        }
        this.model = new Gtk.TreeStore();
        this.model.set_column_types(columns);
        this.treeView.model = this.model;
        this._populateTreeview();
    }

    // treeview search function
    _searchEqualFunc (model, column, key, iter) {
        this.treeView.expand_all();
        const title = model.get_value(iter, 1).toLowerCase();
        key = key.toLowerCase();
        if (title.includes(key))
            return false;
        return true;
    }
});
