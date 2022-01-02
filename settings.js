/* This is a part of Custom Hot Corners - Extended, the Gnome Shell extension*
 * Copyright 2020 Jan Runge <janrunx@gmail.com>
 * Copyright 2021 GdH <georgdh@gmail.com>
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

const {GLib, Gio} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Config = imports.misc.config;
var shellVersion = parseFloat(Config.PACKAGE_VERSION);

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
var _ = Gettext.gettext;

var Triggers = {
    PRESSURE:         0,
    BUTTON_PRIMARY:   1,
    BUTTON_SECONDARY: 2,
    BUTTON_MIDDLE:    3,
    SCROLL_UP:        4,
    SCROLL_DOWN:      5,
};
Object.freeze(Triggers);

var TriggerLabels = [
    _('Hot Corner'),
    _('Primary Button'),
    _('Secondary Button'),
    _('Middle Button'),
    _('Scroll Up'),
    _('Scroll Down'),
];

const _schema = 'org.gnome.shell.extensions.custom-hot-corners-extended';
const _path = '/org/gnome/shell/extensions/custom-hot-corners-extended';

function listTriggers() {
    return Object.values(Triggers);
}

var MscOptions = class MscOptions {
    constructor() {
        this._gsettings = this._loadSettings('misc');
        //this._gsettingsKB = this._loadSettings('shortcuts');
        this._connectionIds = [];
    }

    connect(name, callback) {
        const id = this._gsettings.connect(name, callback);
        this._connectionIds.push(id);
        return id;
    }

    destroy() {
        this._connectionIds.forEach(id => this._gsettings.disconnect(id));
    }

    _loadSettings(schm) {
        const schema = `${_schema}.${schm}`;
        const path = `${_path}/${schm}/`;
        return getSettings(schema, path);
    }

    get watchCorners() {
        return this._gsettings.get_boolean('watch-corners');
    }

    set watchCorners(bool_val) {
        this._gsettings.set_boolean('watch-corners', bool_val);
    }

    get fullscreenGlobal() {
        return this._gsettings.get_boolean('fullscreen-global');
    }

    set fullscreenGlobal(bool_val) {
        this._gsettings.set_boolean('fullscreen-global', bool_val);
    }

    get cornersVisible() {
        return this._gsettings.get_boolean('corners-visible');
    }

    set cornersVisible(bool_val) {
        this._gsettings.set_boolean('corners-visible', bool_val);
    }

    get winSwitchWrap() {
        return this._gsettings.get_boolean('win-switch-wrap');
    }

    set winSwitchWrap(bool_val) {
        this._gsettings.set_boolean('win-switch-wrap', bool_val);
    }

    get winSkipMinimized() {
        return this._gsettings.get_boolean('win-switch-skip-minimized');
    }

    set winSkipMinimized(bool_val) {
        this._gsettings.set_boolean('win-switch-skip-minimized', bool_val);
    }

    get winThumbnailScale() {
        return this._gsettings.get_int('win-thumbnail-scale');
    }

    set winThumbnailScale(scale) {
        this._gsettings.set_int('win-thumbnail-scale', scale);
    }

    get wsSwitchIgnoreLast() {
        return this._gsettings.get_boolean('ws-switch-ignore-last');
    }

    set wsSwitchIgnoreLast(bool_val) {
        this._gsettings.set_boolean('ws-switch-ignore-last', bool_val);
    }

    get wsSwitchWrap() {
        return this._gsettings.get_boolean('ws-switch-wrap');
    }

    set wsSwitchWrap(bool_val) {
        this._gsettings.set_boolean('ws-switch-wrap', bool_val);
    }

    get wsSwitchIndicator() {
        return this._gsettings.get_boolean('ws-switch-indicator');
    }

    set wsSwitchIndicator(bool_val) {
        this._gsettings.set_boolean('ws-switch-indicator', bool_val);
    }

    get wsSwitchIndicatorMode() {
        return this._gsettings.get_int('ws-switch-indicator-mode');
    }

    set wsSwitchIndicatorMode(mode) {
        this._gsettings.set_int('ws-switch-indicator-mode', mode);
    }

    get actionEventDelay() {
        return this._gsettings.get_int('action-event-delay');
    }

    set actionEventDelay(delay) {
        this._gsettings.set_int('action-event-delay', delay);
    }

    get rippleAnimation() {
        return this._gsettings.get_boolean('ripple-animation');
    }

    set rippleAnimation(bool_val) {
        this._gsettings.set_boolean('ripple-animation', bool_val);
    }

    get barrierFallback() {
        return this._gsettings.get_boolean('barrier-fallback');
    }

    set barrierFallback(bool_val) {
        this._gsettings.set_boolean('barrier-fallback', bool_val);
    }

    get customMenu1() {
        return this._gsettings.get_strv('custom-menu-1');
    }

    set customMenu1(list) {
        this._gsettings.set_strv('custom-menu-1', list);
    }

    get customMenu2() {
        return this._gsettings.get_strv('custom-menu-2');
    }

    set customMenu2(list) {
        this._gsettings.set_strv('custom-menu-2', list);
    }

    get customMenu3() {
        return this._gsettings.get_strv('custom-menu-3');
    }

    set customMenu3(list) {
        this._gsettings.set_strv('custom-menu-3', list);
    }

    get customMenu4() {
        return this._gsettings.get_strv('custom-menu-4');
    }

    set customMenu4(list) {
        this._gsettings.set_strv('custom-menu-4', list);
    }

    // extensions that we support and need to know whether they are available
    get supportedExetensions() {
        return this._gsettings.get_strv('supported-active-extensions');
    }

    set supportedExetensions(list) {
        this._gsettings.set_strv('supported-active-extensions', list);
    }

/*    getKeyBind(key) {
        return this._gsettingsKB.get_strv(key);
    }

    setKeyBind(key, value) {
        this._gsettingsKB.set_strv(key, value);
    }*/
};

var Corner = class Corner {
    constructor(loadIndex, monitorIndex, top, left, x, y) {
        this._gsettings = {};
        this.monitorIndex = monitorIndex;
        this._loadIndex = loadIndex;
        this.top = top;
        this.left = left;
        this.x = x;
        this.y = y;
        this._gsettings = this._loadSettingsForTrigges();
        this._connectionIds = [];
        this.hotCornerExists = false;
        this.fullExpandHorizontal = false;
        this.fullExpandVertical = false;

        this.action = {};
        this.ctrl = {};
        this.command = {};
        this.fullscreen = {};
        this.workspaceIndex = {};
        for (let trigger of listTriggers()) {
            this.action[trigger] = this.getAction(trigger);
            this.ctrl[trigger] = this.getCtrl(trigger);
            this.command[trigger] = this.getCommand(trigger);
            this.fullscreen[trigger] = this.getFullscreen(trigger);
            this.workspaceIndex[trigger] = this.getWorkspaceIndex(trigger);
        }
    }

    static forMonitor(loadIndex, index, geometry) {
        let corners = [];
        for (let top of [true, false]) {
            for (let left of [true, false]) {
                let x = left ? geometry.x : geometry.x + geometry.width - 1;
                let y = top ? geometry.y : geometry.y + geometry.height - 1;
                let c = new Corner(loadIndex, index, top, left, x, y);
                corners.push(c);
            }
        }
        return corners;
    }

    connect(name, callback, trigger) {
        const id = this._gsettings[trigger].connect(name, callback);
        this._connectionIds.push([this._gsettings[trigger], id]);
        return id;
    }

    destroy() {
        // log(`[${Me.metadata.name}] Settings.Corner.destroy: Disconnecting corner gsettings..`);
        this._connectionIds.forEach(id => id[0].disconnect(id[1]));
    }

    _loadSettingsForTrigges() {
        let gsettings = {};
        for (let trigger of listTriggers())
            gsettings[trigger] = this._loadSettings(trigger);
        return gsettings;
    }


    getAction(trigger) {
        return this._gsettings[trigger].get_string('action');
    }

    setAction(trigger, action) {
        this._gsettings[trigger].set_string('action', action);
    }

    getCommand(trigger) {
        return this._gsettings[trigger].get_string('command');
    }

    setCommand(trigger, command) {
        this._gsettings[trigger].set_string('command', command);
    }

    getFullscreen(trigger) {
        return this._gsettings[trigger].get_boolean('fullscreen');
    }

    setFullscreen(trigger, bool_val) {
        this._gsettings[trigger].set_boolean('fullscreen', bool_val);
    }

    getWorkspaceIndex(trigger) {
        return this._gsettings[trigger].get_int('workspace-index');
    }

    setWorkspaceIndex(trigger, index) {
        this._gsettings[trigger].set_int('workspace-index', index);
    }

    getCtrl(trigger) {
        return this._gsettings[trigger].get_boolean('ctrl');
    }

    setCtrl(trigger, ctrl) {
        this._gsettings[trigger].set_boolean('ctrl', ctrl);
    }

    get hExpand() {
        return this._gsettings[Triggers.BUTTON_PRIMARY].get_boolean('h-expand');
    }

    set hExpand(bool_val) {
        this._gsettings[Triggers.BUTTON_PRIMARY].set_boolean('h-expand', bool_val);
    }

    get vExpand() {
        return this._gsettings[Triggers.BUTTON_PRIMARY].get_boolean('v-expand');
    }

    set vExpand(bool_val) {
        this._gsettings[Triggers.BUTTON_PRIMARY].set_boolean('v-expand', bool_val);
    }

    get barrierSizeH() {
        return this._gsettings[Triggers.PRESSURE].get_int('barrier-size-h');
    }

    set barrierSizeH(size) {
        this._gsettings[Triggers.PRESSURE].set_int('barrier-size-h', size);
    }

    get barrierSizeV() {
        return this._gsettings[Triggers.PRESSURE].get_int('barrier-size-v');
    }

    set barrierSizeV(size) {
        this._gsettings[Triggers.PRESSURE].set_int('barrier-size-v', size);
    }

    get pressureThreshold() {
        return this._gsettings[Triggers.PRESSURE].get_int('pressure-threshold');
    }

    set pressureThreshold(threshold) {
        this._gsettings[Triggers.PRESSURE].set_int('pressure-threshold', threshold);
    }

    _loadSettings(trigger) {
        const schema = `${_schema}.corner`;
        const v = this.top ? 'top' : 'bottom';
        const h = this.left ? 'left' : 'right';
        let path = `${_path}/`;
        path += `monitor-${this._loadIndex}-${v}-${h}-${trigger}/`;
        return getSettings(schema, path);
    }
};

/**
 * Copied from Gnome Shells extensionUtils.js and adapted to allow
 * loading the setting with a specific path.
 */
function getSettings(schema, path) {
    const schemaDir = Me.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir.get_path(),
            Gio.SettingsSchemaSource.get_default(),
            false
        );
    } else {
        schemaSource = Gio.SettingsSchemaSource.get_default();
    }

    const schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj) {
        //throw new Error(
            'Schema' + schema + ' could not be found for extension ' +
            Me.metadata.uuid + '. Please check your installation.'
        );
        return null;
    }

    const args = {settings_schema: schemaObj};
    if (path) {
        args.path = path;
    }

    return new Gio.Settings(args);
};

function extensionEnabled(uuid = null) {
    const settings = getSettings( 'org.gnome.shell',
                            '/org/gnome/shell/');

    uuid = uuid ? uuid : Me.metadata.uuid;

    let enabled = settings.get_strv('enabled-extensions');
    enabled = enabled.includes(uuid);
    let disabled = settings.get_strv('disabled-extensions');
    disabled = disabled.includes(uuid);
    let disableUser = settings.get_boolean('disable-user-extensions');
    if(enabled && !disabled && !disableUser)
        return true;
    return false;
}

const winSwitcherPopup = extensionEnabled('advanced-alt-tab@G-dH.github.com-dev');
// in extension itself I'd test real workspace configuration
// but settings.js is also used by prefs from which the GS code is unaccessible
const horizontal = shellVersion >= 40;
//      [root/submenu, action key,      action name,                       accelerator allowed, icon name
var actionList = [
        [   0, 'disabled'              ,   _('-'),                                       false,  ''],
        [   0, 'toggle-arcmenu'        ,   _('Open ArcMenu'),                            false,  'view-grid-symbolic'],
        [   0, 'toggle-overview'       ,   _('Show Activities Overview'),                 true,  'view-grid-symbolic'],
        [   0, 'show-applications'     ,   _('Show Application Grid'),                    true,  'view-app-grid-symbolic'],

        [null, 'desktop-submenu'       ,   _('↓ Desktop'),                                true,  'video-display-symbolic'],
        [   1, 'show-desktop'          ,   _('Show Desktop (all monitors)'),              true,  'preferences-desktop-wallpaper-symbolic'],
        [   1, 'show-desktop-mon'      ,   _('Show Desktop (current monitor)'),           true,  'preferences-desktop-wallpaper-symbolic'],
        [   1, 'black-screen'          ,   _('Black Screen (all monitors)'),              true,  'video-display-symbolic'],
        [   1, 'black-screen-mon'      ,   _('Black Screen (current monitor)'),           true,  'video-display-symbolic'],

        [null, 'run-submenu'           ,   _('↓ Run Command'),                           false,  'utilities-terminal-symbolic'],
        [   1, 'run-command'           ,   _('Run preset Command ...'),                      false,  'utilities-terminal-symbolic'],
        [   1, 'run-prompt'            ,   _('Show Run Command Prompt'),                 false,  'utilities-terminal-symbolic'],

        [null, 'workspaces-submenu'    ,   _('↓ Workspaces'),                             true,  'video-display-symbolic'],
        [   1, 'prev-workspace'        ,   _('Previous Workspace'),                       true,   horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  ],
        [   1, 'prev-workspace-overview',  _('Previous Workspace Overview'),              true,   horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  ],
        [   1, 'prev-workspace-popup'  ,   _('Previous Workspace with Win Switcher'),     true,   horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  ],
        [   1, 'next-workspace'        ,   _('Next Workspace'),                           true,   horizontal ? 'go-next-symbolic'    : 'go-down-symbolic'],
        [   1, 'next-workspace-overview',  _('Next Workspace Overview'),                  true,   horizontal ? 'go-next-symbolic'    : 'go-down-symbolic'],
        [   1, 'next-workspace-popup'  ,   _('Next Workspace with Win Switcher'),         true,   horizontal ? 'go-next-symbolic'    : 'go-down-symbolic'],
        [   1, 'recent-workspace'      ,   _('Switch to Recent Workspace'),               true,  'document-open-recent-symbolic'],
        [   1, 'move-to-workspace'     ,   _('Switch to preset Workspace ...'),           false,  'go-jump-symbolic'],
        [   1, 'reorder-ws-prev'       ,   _(`Reorder Workspace - ${horizontal? _('Left') : _('Up')}`),  true,  horizontal ? 'go-previous-symbolic':'go-up-symbolic'],
        [   1, 'reorder-ws-next'       ,   _(`Reorder Workspace - ${horizontal? _('Right'): _('Down')}`),true,  horizontal ? 'go-next-symbolic':'go-down-symbolic'  ],

        [null, 'win-navigation-submenu',   _('↓ Windows - Navigation'),                   true,  'focus-windows-symbolic'],
        [   1, 'recent-win'            ,   _('Switch to Recent Window'),                  true,  'document-open-recent-symbolic'],
        [   1, 'prev-win-mon'          ,   _('Previous Window (current monitor)'),        true,  'go-previous-symbolic'],
        [   1, 'prev-win-ws'           ,   _('Previous Window (current WS)'),             true,  'go-previous-symbolic'],
        [   1, 'prev-win-all'          ,   _('Previous Window (all)'),                    true,  'go-previous-symbolic'],
        [   1, 'next-win-mon'          ,   _('Next Window (current monitor)'),            true,  'go-next-symbolic'],
        [   1, 'next-win-ws'           ,   _('Next Window (current WS)'),                 true,  'go-next-symbolic'],
        [   1, 'next-win-all'          ,   _('Next Window (all)'),                        true,  'go-next-symbolic'],

        [null, 'win-switcher-popup-submenu', _('↓ Windows/App - Switcher Popups'),        true,  'focus-windows-symbolic'],
        [   1, 'win-switcher-popup-all',   _('Window Switcher Popup (all/default)'),      true,  'focus-windows-symbolic'],
        [   1, 'win-switcher-popup-ws' ,   _('Window Switcher Popup (current ws)'),       true,  'focus-windows-symbolic'],
        [   1, 'win-switcher-popup-mon',   _('Window Switcher Popup (current monitor)'),  true,  'focus-windows-symbolic'],
        [   1, 'win-switcher-popup-ws-first', _('Window Switcher Popup (current ws first)') ,true,  'focus-windows-symbolic'],
        [   1, 'win-switcher-popup-apps',  _('Window Switcher Popup (sorted by apps)'),   true,  'focus-windows-symbolic'],
        [   1, 'win-switcher-popup-class', _('Window Switcher Popup (focused app only)'), true,  'focus-windows-symbolic'],
        //[   1, 'win-switcher-popup-search', _('Window Switcher Popup (type to search)'),  true,  'focus-windows-symbolic'],
        [   1, 'app-switcher-popup-all',   _('App Switcher Popup (all/default)'),         true,  'focus-windows-symbolic'],
        [   1, 'app-switcher-popup-ws' ,   _('App Switcher Popup (current ws)'),          true,  'focus-windows-symbolic'],
        [   1, 'app-switcher-popup-mon',   _('App Switcher Popup (current monitor)'),     true,  'focus-windows-symbolic'],
        //[   1, 'app-switcher-popup-all-fav',_('App Switcher Popup (current monitor)'),    true,  'focus-windows-symbolic'],

        [null, 'win-control-submenu'   ,   _('↓ Windows - Control'),                      true,  'focus-windows-symbolic'],
        [   1, 'close-win'             ,   _('Close window'),                             true,  'window-close-symbolic'],
        [   1, 'maximize-win'          ,   _('Maximize window (toggle)'),                 true,  'window-maximize-symbolic'],
        [   1, 'minimize-win'          ,   _('Minimize window'),                          true,  'window-minimize-symbolic'],
        [   1, 'fullscreen-win'        ,   _('Fullscreen window (toggle)'),               true,  'view-fullscreen-symbolic'],
        [   1, 'fullscreen-on-empty-ws',   _('Fullscreen window on New WS (toggle)'),     true,  'view-fullscreen-symbolic'],
        [   1, 'above-win'             ,   _('Always on Top window (toggle)'),            true,  'go-top-symbolic'],
        [   1, 'stick-win'             ,   _('Always on Visible WS window (toggle)'),     true,  'view-pin-symbolic'],
        [   1, 'quit-app'              ,   _('Quit focused application'),                 true,  'window-close-symbolic'],
        [   1, 'kill-app'              ,   _('Kill focused application (kill -9)'),       true,  'process-stop-symbolic'],
        [   1, 'open-new-window'       ,   _('Open New window (if supported)'),           false,  'media-playback-start-symbolic'],
        [   1, 'unminimize-all-ws'     ,   _('Unminimize all windows (workspace)'),       true,  'window-restore-symbolic'],

        [null, 'win-control-submenu'   ,   _('↓ Windows - Relocations'),                  true,  'focus-windows-symbolic'],
        [   1, 'move-win-to-prev-ws'   ,   _('Move window to Previous workspace'),        true,  horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  ],
        [   1, 'move-win-to-prev-new-ws',  _('Move window to New workspace Prev'),        true,  horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  ],
        [   1, 'move-win-to-next-ws'   ,   _('Move window to Next workspace'),            true,  horizontal ? 'go-next-symbolic'    : 'go-down-symbolic'],
        [   1, 'move-win-to-next-new-ws',  _('Move window to New workspace Next'),        true,  horizontal ? 'go-next-symbolic'    : 'go-down-symbolic'],
        [   1, 'move-app-to-prev-ws',      _('Move app windows to Prev workspace'),       true,  horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  ],
        [   1, 'move-app-to-prev-new-ws',  _('Move app windows to New workspace Prev'),   true,  horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  ],
        [   1, 'move-app-to-next-ws',      _('Move app windows to Next workspace'),       true,  horizontal ? 'go-next-symbolic'    : 'go-down-symbolic'],
        [   1, 'move-app-to-next-new-ws',  _('Move app windows to New workspace Next'),   true,  horizontal ? 'go-next-symbolic'    : 'go-down-symbolic'],

        [null, 'win-thumbnails-submenu',   _('↓ DND Window Thumbnails (Clones / PIP)'),   true,  ''],
        [   1, 'make-thumbnail-win'    ,   _('Create Window Thumbnail (at bottom-right)'),true,  ''],
        [   1, 'minimize-to-thumbnail' ,   _('Minimize Window to Thumbnail')             ,true,  ''],
        [   1, 'remove-win-thumbnails' ,   _('Remove all Window Thumbnails'),             true,  ''],

        [null, 'win-adjust-submenu'    ,   _('↓ Windows - Visual Adjustments'),           true,  'view-reveal-symbolic'],
        [   1, 'bright-up-win'         ,   _('Brightness Up (window)'),                   true,  'display-brightness-symbolic'],
        [   1, 'bright-down-win'       ,   _('Brightness Down (window)'),                 true,  'display-brightness-symbolic'],
        [   1, 'contrast-up-win'       ,   _('Contrast Up (window)'),                     true,  'view-reveal-symbolic'],
        [   1, 'contrast-down-win'     ,   _('Contrast Down (window)'),                   true,  'view-reveal-symbolic'],
        [   1, 'contrast-high-win'     ,   _('High Contrast (window)'),                   true,  'view-reveal-symbolic'],
        [   1, 'contrast-low-win'      ,   _('Low Contrast (window)'),                    true,  'view-reveal-symbolic'],
        [   1, 'opacity-up-win'        ,   _('Opacity Up (window)'),                      true,  'view-reveal-symbolic'],
        [   1, 'opacity-down-win'      ,   _('Opacity Down (window)'),                    true,  'view-reveal-symbolic'],
        [   1, 'opacity-toggle-win'    ,   _('Opacity 78% (window)'),                     true,  'view-reveal-symbolic'],
        [   1, 'opacity-toggle-hc-win' ,   _('Opacity 78% for dark themes (window)'),     true,  'view-reveal-symbolic'],
        [   1, 'opacity-toggle-lc-win' ,   _('Opacity 94% + bit of contrast (window)'),   true,  'view-reveal-symbolic'],

        [null, 'win-effects-submenu'   ,   _('↓ Windows - Color Effects'),                true,  'view-reveal-symbolic'],
        [   1, 'invert-light-win'      ,   _('Invert Lightness (window)'),                true,  'view-reveal-symbolic'],
        [   1, 'invert-light-shift-win',   _('Invert Lightness - White to Grey (window)'),true,  'view-reveal-symbolic'],
        [   1, 'invert-colors-win'     ,   _('Invert Colors (window)'),                   true,  'view-reveal-symbolic'],
        [   1, 'tint-red-toggle-win'   ,   _('Red Tint Mono (window)'),                   true,  'view-reveal-symbolic'],
        [   1, 'tint-green-toggle-win' ,   _('Green Tint Mono (window)'),                 true,  'view-reveal-symbolic'],
        [   1, 'desaturate-win'        ,   _('Desaturate (window)'),                      true,  'view-reveal-symbolic'],
        [   1, 'remove-effects-win'    ,   _('Remove All Effects (window)'),              true,  'window-close-symbolic'],

        [null, 'global-effects-submenu',   _('↓ Global Effects'),                         true,  'view-reveal-symbolic'],
        [   1, 'bright-up-all'         ,   _('Brightness Up (global)'),                   true,  'display-brightness-symbolic'],
        [   1, 'bright-down-all'       ,   _('Brightness Down (global)'),                 true,  'display-brightness-symbolic'],
        [   1, 'contrast-up-all'       ,   _('Contrast Up (global)'),                     true,  'view-reveal-symbolic'],
        [   1, 'contrast-down-all'     ,   _('Contrast Down (global)'),                   true,  'view-reveal-symbolic'],
        [   1, 'contrast-high-all'     ,   _('High Contrast (global)'),                   true,  'view-reveal-symbolic'],
        [   1, 'contrast-low-all'      ,   _('Low Contrast (global)'),                    true,  'view-reveal-symbolic'],
        [   1, 'invert-light-all'      ,   _('Invert Lightness (global)'),                true,  'view-reveal-symbolic'],
        [   1, 'invert-light-shift-all',   _('Invert Lightness - White to Grey (global)'),true,  'view-reveal-symbolic'],
        [   1, 'tint-red-toggle-all'   ,   _('Red Tint Mono (global)'),                   true,  'view-reveal-symbolic'],
        [   1, 'tint-green-toggle-all' ,   _('Green Tint Mono (global)'),                 true,  'view-reveal-symbolic'],
        [   1, 'desaturate-all'        ,   _('Desaturate (global)'),                      true,  'view-reveal-symbolic'],
        [   1, 'remove-effects-all'    ,   _('Remove All Effects (global)'),              true,  'window-close-symbolic'],

        [null, 'access-submenu'        ,   _('↓ Universal Access'),                       true,  'preferences-desktop-accessibility-symbolic'],
        [   1, 'toggle-zoom'           ,   _('Magnifier - Zoom 2x (toggle)'),             true,  'zoom-in-symbolic'],
        [   1, 'zoom-in'               ,   _('Magnifier - Zoom In'),                      true,  'zoom-in-symbolic'],
        [   1, 'zoom-out'              ,   _('Magnifier - Zoom Out'),                     true,  'zoom-out-symbolic'],
        [   1, 'screen-reader'         ,   _('Screen Reader (toggle)'),                   true,  'audio-speakers-symbolic'],
        [   1, 'large-text'            ,   _('Large Text (toggle)'),                      true,  'insert-text-symbolic'],
        [   1, 'keyboard'              ,   _('Screen Keyboard (toggle)'),                 true,  'input-keyboard-symbolic'],
        [   1, 'invert-light-all'      ,   _('Invert Lightness (global)'),                true,  'view-reveal-symbolic'],
        [   1, 'protan-toggle-all'     ,   _('Color Correction - Protanopia (window)'),   true,  'view-reveal-symbolic'],
        [   1, 'deuter-toggle-all'     ,   _('Color Correction - Deuteranopia (window)'), true,  'view-reveal-symbolic'],
        [   1, 'tritan-toggle-all'     ,   _('Color Correction - Tritanopia (window)'),   true,  'view-reveal-symbolic'],
        [   1, 'protan-sim-toggle-all' ,   _('Color Simulation - Protanopia (window)'),   true,  'view-reveal-symbolic'],
        [   1, 'deuter-sim-toggle-all' ,   _('Color Simulation - Deuteranopia (window)'), true,  'view-reveal-symbolic'],
        [   1, 'tritan-sim-toggle-all' ,   _('Color Simulation - Tritanopia (window)'),   true,  'view-reveal-symbolic'],
        [   1, 'mixer-gbr-toggle-all'  ,   _('Color Mixer GBR'),                          true,  'view-reveal-symbolic'],

        [null, 'gnome-submenu'         ,   _('↓ Gnome'),                                  true,  'start-here-symbolic'],
        [   1, 'hide-panel'            ,   _('Hide Main Panel toggle'),                   true,  'focus-top-bar-symbolic'],
        [   1, 'toggle-theme'          ,   _('Light/Dark Gtk Theme toggle'),              true,  'view-reveal-symbolic'],
        [   1, 'night-light-toggle'    ,   _('Night Light toggle'),                       true,  'night-light-symbolic'],

        [null, 'system-submenu'        ,   _('↓ System'),                                 true,  'system-run-symbolic'],
        [   1, 'lock-screen'           ,   _('Lock Screen'),                              true,  'changes-prevent-symbolic'],
        [   1, 'suspend'               ,   _('Suspend to RAM'),                           true,  'weather-clear-night-symbolic'],
        [   1, 'power-off'             ,   _('Power Off Dialog'),                         true,  'system-shutdown-symbolic'],
        [   1, 'log-out'               ,   _('Log Out Dialog'),                           true,  'system-log-out-symbolic'],
        [   1, 'switch-user'           ,   _('Switch User (if exists)'),                  true,  'system-switch-user-symbolic'],

        [null, 'media-submenu'         ,   _('↓ Media'),                                  true,  'audio-volume-medium-symbolic'],
        [   1, 'volume-up'             ,   _('Volume Up'),                                true,  'audio-volume-high-symbolic'],
        [   1, 'volume-down'           ,   _('Volume Down'),                              true,  'audio-volume-low-symbolic'],
        [   1, 'mute-sound'            ,   _('Mute Audio (toggle)'),                      true,  'audio-volume-muted-symbolic'],
        [   1, 'mpris-play-pause'      ,   _('Media key - Play/Pause'),                   true,  'media-playback-start-symbolic'],
        [   1, 'mpris-next'            ,   _('Media key - Next Track'),                   true,  'media-skip-forward-symbolic'],
        [   1, 'mpris-prev'            ,   _('Media key - Previous Track'),               true,  'media-skip-backward-symbolic'],

        [null, 'debug-submenu'         ,   _('↓ Debug'),                                  true,  'edit-find-symbolic'],
        [   1, 'looking-glass'         ,   _('Looking Glass (GS debugger)'),              true,  'edit-find-symbolic'],
        [   1, 'restart-shell'         ,   _('Restart Gnome Shell (X11 only)'),           true,  'view-refresh-symbolic'],

        [null, 'custom-menus-submenu'  ,   _('↓ Custom Menus'),                           true,  'open-menu-symbolic'],
        [   1, 'show-custom-menu-1'    ,   _('Show Custom Menu 1'),                       true,  'open-menu-symbolic'],
        [   1, 'show-custom-menu-2'    ,   _('Show Custom Menu 2'),                       true,  'open-menu-symbolic'],
        [   1, 'show-custom-menu-3'    ,   _('Show Custom Menu 3'),                       true,  'open-menu-symbolic'],
        [   1, 'show-custom-menu-4'    ,   _('Show Custom Menu 4'),                       true,  'open-menu-symbolic'],
        [   0, 'prefs'                 ,   _('Open Preferences'),                         true,  'preferences-system-symbolic']
    ]; // end
