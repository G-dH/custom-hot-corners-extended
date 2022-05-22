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

const { Gtk, Gio, GLib, GObject } = imports.gi;

const ExtensionUtils  = imports.misc.extensionUtils;
const Me              = ExtensionUtils.getCurrentExtension();

const Settings        = Me.imports.src.common.settings;
const triggers        = Settings.listTriggers();
const triggerLabels   = Settings.TriggerLabels;
const _actionList     = Settings.actionList;
const _excludedItems  = Settings.excludedItems;

const MonitorPages    = Me.imports.src.prefs.monitorPages;
const KeyboardPage    = Me.imports.src.prefs.keyboardPage.KeyboardPage;
const CustomMenusPage = Me.imports.src.prefs.customMenusPage.CustomMenusPage;
const OptionsPage     = Me.imports.src.prefs.optionsPage.OptionsPage;

const Utils           = Me.imports.src.common.utils;
const _newImageFromIconName = Utils._newImageFromIconName;
// conversion of Gtk3 / Gtk4 widgets add methods
const append = Utils.append;
const set_child = Utils.set_child;

// gettext
const _  = Settings._;

const shellVersion = Settings.shellVersion;

const Triggers = Settings.Triggers;

let Adw = null;
try { Adw = imports.gi.Adw; } catch (e) {}

const TRANSITION_DURATION = Settings.TRANSITION_DURATION;

const MONITOR_ICON = Settings.MONITOR_ICON;
const KEYBOARD_TITLE = Settings.KEYBOARD_TITLE;
const KEYBOARD_ICON = Settings.KEYBOARD_ICON;
const MENUS_TITLE = Settings.MENUS_TITLE;
const MENUS_ICON = Settings.MENUS_ICON;
const OPTIONS_TITLE = Settings.OPTIONS_TITLE;
const OPTIONS_ICON = Settings.OPTIONS_ICON;


function init() {
    // log(`initializing ${Me.metadata.name} Preferences`);
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    // WAYLAND = GLib.getenv('XDG_SESSION_TYPE') === 'wayland';
}

function fillPreferencesWindow(window) {
    const mscOptions = new Settings.MscOptions();

    const resources = Gio.Resource.load(Me.path + '/resources/custom-hot-corners-extended.gresource');
    Gio.resources_register(resources);

    const monitorPages = MonitorPages.getMonitorPages(mscOptions);
    for (let mPage of monitorPages) {
        const [page, title] = mPage;
        const monAdwPage = new Adw.PreferencesPage({
            title: title,
            icon_name: MONITOR_ICON
        });
        const monGroup = new Adw.PreferencesGroup();
        page.buildPage();
        monGroup.add(page);
        monAdwPage.add(monGroup);
        window.add(monAdwPage);
    }

    let keyboardAdwPage = new Adw.PreferencesPage({
        title: KEYBOARD_TITLE,
        icon_name: KEYBOARD_ICON
    });
    let keyboardGroup = new Adw.PreferencesGroup();
    let keyboardPage = new KeyboardPage(mscOptions);
    keyboardPage.buildPage();

    keyboardGroup.add(keyboardPage);
    keyboardAdwPage.add(keyboardGroup);
    window.add(keyboardAdwPage);

    let customMenusAdwPage = new Adw.PreferencesPage({
        title: MENUS_TITLE,
        icon_name: MENUS_ICON
    });
    let customMenuGroup = new Adw.PreferencesGroup();
    let customMenusPage = new CustomMenusPage(mscOptions);
    customMenusPage.buildPage();

    customMenuGroup.add(customMenusPage);
    customMenusAdwPage.add(customMenuGroup);
    window.add(customMenusAdwPage);

    const optionsAdwPage = new OptionsPage(mscOptions, {
        title: OPTIONS_TITLE,
        icon_name: OPTIONS_ICON
    });
    window.add(optionsAdwPage);

    window.set_default_size(600, 700);

    window.connect('close-request', () => {
        mscOptions.set('showOsdMonitorIndexes', false);
        // mscOptions/corner.destroy() removes gsetting connections
        mscOptions.destroy();
        monitorPages.forEach((page) => {
            page[0]._corners.forEach((corner) => {
                corner.destroy();
            })
        });

        Gio.resources_unregister(resources);
    });

    return window;
}

function buildPrefsWidget() {
    const mscOptions = new Settings.MscOptions();

    const resources = Gio.Resource.load(Me.path + '/resources/custom-hot-corners-extended.gresource');
    Gio.resources_register(resources);

    const stack = new Gtk.Stack({
        hexpand: true
    });
    const stackSwitcher = new Gtk.StackSwitcher();
    const context = stackSwitcher.get_style_context();
    context.add_class('caption');
    stack.connect('notify::visible-child', () => {
        stack.get_visible_child().buildPage();
    });
    stackSwitcher.set_stack(stack);
    stack.set_transition_duration(TRANSITION_DURATION);
    stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT);

    const pagesBtns = [];
    const monitorPages = MonitorPages.getMonitorPages(mscOptions);

    let firstPageBuilt = false;
    for (let mPage of monitorPages) {
        const [page, title] = mPage;
        if (!firstPageBuilt) {
            page.buildPage();
            firstPageBuilt = true;
        }
        stack.add_named(page, title);
        pagesBtns.push([new Gtk.Label({ label: title }), _newImageFromIconName(MONITOR_ICON, Gtk.IconSize.BUTTON)]);
    }

    const kbPage = new KeyboardPage(mscOptions);
    const cmPage = new CustomMenusPage(mscOptions);
    const optionsPage = new OptionsPage(mscOptions);

    stack.add_named(kbPage, 'keyboard');
    stack.add_named(cmPage, 'custom-menus');
    stack.add_named(optionsPage, 'options');

    pagesBtns.push([new Gtk.Label({ label: KEYBOARD_TITLE }), _newImageFromIconName(KEYBOARD_ICON, Gtk.IconSize.BUTTON)]);
    pagesBtns.push([new Gtk.Label({ label: MENUS_TITLE }),  _newImageFromIconName(MENUS_ICON, Gtk.IconSize.BUTTON)]);
    pagesBtns.push([new Gtk.Label({ label: OPTIONS_TITLE }),  _newImageFromIconName(OPTIONS_ICON, Gtk.IconSize.BUTTON)]);

    stack.show_all && stack.show_all();

    let stBtn = stackSwitcher.get_first_child ? stackSwitcher.get_first_child() : null;
    for (let i = 0; i < pagesBtns.length; i++) {
        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 6, visible: true});
        const icon = pagesBtns[i][1];
        icon.margin_start = 30;
        icon.margin_end = 30;
        box[append](icon);
        box[append](pagesBtns[i][0]);
        if (stackSwitcher.get_children) {
            stBtn = stackSwitcher.get_children()[i];
            stBtn.add(box);
        } else {
            stBtn.set_child(box);
            stBtn.visible = true;
            stBtn = stBtn.get_next_sibling();
        }
    }

    stack.show_all && stack.show_all();
    stackSwitcher.show_all && stackSwitcher.show_all();

    stack.connect('realize', (widget) => {
        const window = widget.get_root ? widget.get_root() : widget.get_toplevel();
        const headerbar = window.get_titlebar();
        if (shellVersion >= 40) {
            headerbar.title_widget = stackSwitcher;
        } else {
            headerbar.custom_title = stackSwitcher;
        }

        const signal = Gtk.get_major_version() === 3 ? 'destroy' : 'close-request';
        window.connect(signal, () => {
            mscOptions.set('showOsdMonitorIndexes', false);
            // mscOptions/corner.destroy() removes gsetting connections
            mscOptions.destroy();
            monitorPages.forEach((page) => {
                page[0]._corners.forEach((corner) => {
                    corner.destroy();
                });
            });
            Gio.resources_unregister(resources);
        });
    });


    return stack;
}
