/**
 * Custom Hot Corners - Extended
 * Prefs
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Gio from 'gi://Gio';
import Adw from 'gi://Adw';

import * as Settings from './src/common/settings.js';
import * as MonitorPages from './src/prefs/monitorPages.js';
import * as KeyboardPage from './src/prefs/keyboardPage.js';
import * as CustomMenusPage from './src/prefs/customMenusPage.js';
import * as OptionsPage from './src/prefs/optionsPage.js';
import * as AboutPage from './src/prefs/aboutPage.js';
import * as ActionChooserDialog from './src/prefs/actionChooserDialog.js';
import * as ActionList from './src/prefs/actionList.js';
import * as TreeViewPage from './src/prefs/treeViewPage.js';
import * as Utils from './src/common/utils.js';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// gettext
let _;

export default class CustomHotCornersExtended extends ExtensionPreferences {
    constructor(metadata) {
        super(metadata);

        // log(`initializing ${Me.metadata.name} Preferences`);

        _ = this.gettext.bind(this);

        Utils.init(this);
        ActionList.init(this);
        Settings.init(this);
        MonitorPages.init(this);
        KeyboardPage.init(this);
        CustomMenusPage.init(this);
        OptionsPage.init(this);
        AboutPage.init(this);
        ActionChooserDialog.init(this);
        TreeViewPage.init(this);

        this._pageList = [
            {
                name: 'keyboard',
                title: _('Keyboard'),
                iconName: 'input-keyboard-symbolic',
                pageClass: KeyboardPage.KeyboardPage,
            },
            {
                name: 'menus',
                title: _('Custom Menus'),
                iconName: 'open-menu-symbolic',
                pageClass: CustomMenusPage.CustomMenusPage,
            },
            {
                name: 'options',
                title: _('Options'),
                iconName: 'preferences-other-symbolic',
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

    fillPreferencesWindow(window) {
        const mscOptions = new Settings.MscOptions();

        const resources = Gio.Resource.load(`${this.path}/resources/custom-hot-corners-extended.gresource`);
        Gio.resources_register(resources);

        const monitorPages = MonitorPages.getMonitorPages(mscOptions);
        for (let mPage of monitorPages) {
            const [page, title] = mPage;
            const monAdwPage = new Adw.PreferencesPage({
                title,
                icon_name: 'video-display-symbolic',
            });
            page.buildPage();
            const group = new Adw.PreferencesGroup();
            group.add(page);
            monAdwPage.add(group);
            window.add(monAdwPage);
        }

        for (let page of this._pageList) {
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

        window.set_default_size(700, 880);

        window.connect('close-request', () => {
            mscOptions.set('showOsdMonitorIndexes', false);
            // mscOptions/corner.destroy() removes gsetting connections
            mscOptions.destroy();
            monitorPages.forEach(page => {
                page[0]._corners.forEach(corner => {
                    corner.destroy();
                });
            });

            Gio.resources_unregister(resources);

            MonitorPages.cleanGlobals();
            KeyboardPage.cleanGlobals();
            CustomMenusPage.cleanGlobals();
            OptionsPage.cleanGlobals();
            AboutPage.cleanGlobals();
            ActionChooserDialog.cleanGlobals();
            ActionList.cleanGlobals();
            TreeViewPage.cleanGlobals();
            Utils.cleanGlobals();
            Settings.cleanGlobals();
        });

        return window;
    }
}
