/**
 * Custom Hot Corners - Extended
 * Prefs
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

const { Gtk, Gio, GLib, GObject } = imports.gi;

const ExtensionUtils  = imports.misc.extensionUtils;
const Me              = ExtensionUtils.getCurrentExtension();

const OptionsFactory  = Me.imports.src.prefs.optionsFactory;
const Settings        = Me.imports.src.common.settings;

const MonitorPages    = Me.imports.src.prefs.monitorPages;
const KeyboardPage    = Me.imports.src.prefs.keyboardPage.KeyboardPage;
const CustomMenusPage = Me.imports.src.prefs.customMenusPage.CustomMenusPage;
const OptionsPage     = Me.imports.src.prefs.optionsPage;
const AboutPage       = Me.imports.src.prefs.aboutPage;

const Utils           = Me.imports.src.common.utils;

// conversion of Gtk3 / Gtk4 widgets add methods
const append = Utils.append;

// gettext
const _  = Settings._;

const shellVersion = Settings.shellVersion;

const Triggers = Settings.Triggers;
const TRANSITION_TIME = Settings.TRANSITION_TIME;

let Adw = null;
try {
    Adw = imports.gi.Adw;
} catch (e) {}

let pageList;

function init() {
    // log(`initializing ${Me.metadata.name} Preferences`);
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);

    pageList = [
        {
            name: 'keyboard',
            title: Settings.KEYBOARD_TITLE,
            iconName: Settings.KEYBOARD_ICON,
            pageClass: KeyboardPage,
        },
        {
            name: 'menus',
            title: Settings.MENUS_TITLE,
            iconName: Settings.MENUS_ICON,
            pageClass: CustomMenusPage,
        },
        {
            name: 'options',
            title: Settings.OPTIONS_TITLE,
            iconName: Settings.OPTIONS_ICON,
            pageClass: Adw ? OptionsPage.MscOptionsPageAdw : OptionsPage.MscOptionsPageLegacy,
        },
        {
            name: 'about',
            title: _('About'),
            iconName: 'preferences-system-details-symbolic',
            pageClass: Adw ? AboutPage.AboutPageAdw : AboutPage.AboutPageLegacy,
        },
    ];
}

function fillPreferencesWindow(window) {
    const mscOptions = new Settings.MscOptions();

    const resources = Gio.Resource.load(`${Me.path}/resources/custom-hot-corners-extended.gresource`);
    Gio.resources_register(resources);

    const monitorPages = MonitorPages.getMonitorPages(mscOptions);
    for (let mPage of monitorPages) {
        const [page, title] = mPage;
        const monAdwPage = new Adw.PreferencesPage({
            title,
            icon_name: Settings.MONITOR_ICON,
        });
        page.buildPage();
        const group = new Adw.PreferencesGroup();
        group.add(page);
        monAdwPage.add(group);
        window.add(monAdwPage);
    }


    for (let page of pageList) {
        const title = page.title;
        const iconName = page.iconName;
        const pageClass = page.pageClass;

        const pp = new pageClass(mscOptions, { title, iconName });
        // only options pages return complete Adw.Page
        if (pp instanceof Adw.PreferencesPage) {
            page = pp;
        } else {
            page = new Adw.PreferencesPage({
                title,
                iconName,
            });
            const group = new Adw.PreferencesGroup();
            group.add(pp);
            page.add(group);
        }

        window.add(page);
    }

    window.set_default_size(700, 800);

    window.connect('close-request', () => {
        mscOptions.set('showOsdMonitorIndexes', false);
        // mscOptions/corner.destroy() removes gsetting connections
        mscOptions.destroy();
        monitorPages.forEach(page => {
            page[0]._corners.forEach(corner => {
                corner.destroy();
            });
        });

        pageList = null;

        Gio.resources_unregister(resources);
    });

    return window;
}

function buildPrefsWidget() {
    const mscOptions = new Settings.MscOptions();

    const resources = Gio.Resource.load(`${Me.path}/resources/custom-hot-corners-extended.gresource`);
    Gio.resources_register(resources);



    const stack = new Gtk.Stack({
        hexpand: true,
    });
    const stackSwitcher = new Gtk.StackSwitcher({
        halign: Gtk.Align.CENTER,
        hexpand: true,
    });
    if (shellVersion < 40)
        stackSwitcher.homogeneous = true;
    const context = stackSwitcher.get_style_context();
    context.add_class('caption');

    stackSwitcher.set_stack(stack);
    stack.set_transition_duration(TRANSITION_TIME);
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
        pagesBtns.push([new Gtk.Label({ label: title }), Utils.newImageFromIconName(Gtk, Settings.MONITOR_ICON, Gtk.IconSize.BUTTON)]);
    }

    for (let page of pageList) {
        const name = page.name;
        const title = page.title;
        const iconName = page.iconName;
        const pageClass = page.pageClass;

        stack.add_named(new pageClass(mscOptions), name);
        pagesBtns.push(
            [new Gtk.Label({ label: title }), Utils.newImageFromIconName(Gtk, iconName, Gtk.IconSize.BUTTON)]
        );
    }

    if (stack.show_all)
        stack.show_all();

    let stBtn = stackSwitcher.get_first_child ? stackSwitcher.get_first_child() : null;
    for (let i = 0; i < pagesBtns.length; i++) {
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6, visible: true });
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

    if (stack.show_all)
        stack.show_all();
    if (stackSwitcher.show_all)
        stackSwitcher.show_all();

    stack.connect('realize', widget => {
        const window = widget.get_root ? widget.get_root() : widget.get_toplevel();
        const headerbar = window.get_titlebar();
        if (shellVersion >= 40)
            headerbar.title_widget = stackSwitcher;
        else
            headerbar.custom_title = stackSwitcher;


        const signal = Gtk.get_major_version() === 3 ? 'destroy' : 'close-request';
        window.connect(signal, () => {
            mscOptions.set('showOsdMonitorIndexes', false);
            // mscOptions/corner.destroy() removes gsetting connections
            mscOptions.destroy();
            monitorPages.forEach(page => {
                page[0]._corners.forEach(corner => {
                    corner.destroy();
                });
            });
            Gio.resources_unregister(resources);
        });
    });


    return stack;
}
